import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

/**
 * Built-in segments: computed, never stored. Every customer is in exactly one, checked in this
 * order (Cairo days; "joined" = the card's first day, i.e. the earlier of its creation and its
 * first visit):
 * - new: joined in the last 30 days
 * - never_visited: joined over 30 days ago, no visit yet
 * - champions: a visit in the last 30 days and 2+ visits in those 30 days
 * - regulars: a visit in the last 30 days (only one)
 * - lost: no visit for over 120 days
 * - at_risk: quiet for 30-120 days after 3+ visits (used to come often)
 * - slipping: quiet for 30-120 days, an occasional customer (1-2 visits)
 */
export const SEGMENTS = [
  'champions',
  'regulars',
  'new',
  'never_visited',
  'slipping',
  'at_risk',
  'lost',
] as const;
export type CustomerSegment = (typeof SEGMENTS)[number];

/** SQL for the built-in segment over the base roster columns (see the service). */
export const SEGMENT_SQL = Prisma.sql`CASE
  WHEN joined_days < 30 THEN 'new'
  WHEN last_visit IS NULL THEN 'never_visited'
  WHEN days_since_visit < 30 AND visits30 >= 2 THEN 'champions'
  WHEN days_since_visit < 30 THEN 'regulars'
  WHEN days_since_visit > 120 THEN 'lost'
  WHEN visits >= 3 THEN 'at_risk'
  ELSE 'slipping'
END`;

/** What a custom segment's rules can look at (all in the customers page's scope). */
export const RULE_FIELDS = {
  visits: 'visits',
  visits_30d: 'visits30',
  spend: 'spend',
  days_since_visit: 'days_since_visit',
  days_since_joined: 'joined_days',
  points: 'balance',
  rewards_redeemed: 'redemptions',
  segment: 'segment',
} as const;
export type RuleField = keyof typeof RULE_FIELDS;
export const RULE_OPS = ['gte', 'lte', 'eq', 'is', 'is_not'] as const;
export type RuleOp = (typeof RULE_OPS)[number];
export const MAX_RULES = 10;

export interface SegmentRule {
  field: RuleField;
  op: RuleOp;
  value: number | string;
}

/** Checks a rule list (field/op/value combinations) and returns it cleaned; 400 invalid_rules. */
export function checkRules(rules: SegmentRule[]): SegmentRule[] {
  const bad = (detail: string) => new BadRequestException({ code: 'invalid_rules', message: detail });
  if (rules.length > MAX_RULES) throw bad(`At most ${MAX_RULES} rules`);
  return rules.map((r, i) => {
    if (!(r.field in RULE_FIELDS)) throw bad(`Rule ${i + 1}: unknown field`);
    if (r.field === 'segment') {
      if (r.op !== 'is' && r.op !== 'is_not') throw bad(`Rule ${i + 1}: segment takes is / is_not`);
      if (!SEGMENTS.includes(r.value as CustomerSegment)) throw bad(`Rule ${i + 1}: unknown segment`);
      return { field: r.field, op: r.op, value: r.value };
    }
    if (r.op !== 'gte' && r.op !== 'lte' && r.op !== 'eq') throw bad(`Rule ${i + 1}: use gte / lte / eq`);
    const n = typeof r.value === 'string' ? Number(r.value) : r.value;
    if (!Number.isFinite(n) || n < 0 || n > 1e9) throw bad(`Rule ${i + 1}: value must be a number ≥ 0`);
    return { field: r.field, op: r.op, value: n };
  });
}

/** One rule as SQL over the roster columns. A missing value (no visit yet, branch scope points) never matches. */
function ruleSql(r: SegmentRule): Prisma.Sql {
  const col = Prisma.raw(RULE_FIELDS[r.field]);
  if (r.field === 'segment') return r.op === 'is' ? Prisma.sql`${col} = ${r.value}` : Prisma.sql`${col} <> ${r.value}`;
  const op = Prisma.raw({ gte: '>=', lte: '<=', eq: '=' }[r.op as 'gte' | 'lte' | 'eq']);
  return Prisma.sql`coalesce(${col} ${op} ${r.value}::numeric, false)`;
}

/** All / any of the rules; no rules = nobody (a hand-made segment). */
export function rulesSql(match: 'all' | 'any', rules: SegmentRule[]): Prisma.Sql {
  if (!rules.length) return Prisma.sql`false`;
  return Prisma.sql`(${Prisma.join(rules.map(ruleSql), match === 'all' ? ' AND ' : ' OR ')})`;
}
