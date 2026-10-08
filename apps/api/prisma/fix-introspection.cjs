// Runs after `prisma db pull` (npm run db:pull). Corrects what introspection gets wrong.
//
// point_rules has a PARTIAL unique index "one ACTIVE rule per vendor"
// (point_rules_one_active_uq ... WHERE is_active). Prisma's partialIndexes preview reads it as
// "vendor_id is unique", which makes vendors -> point_rules one-to-one and lets
// findUnique({ vendor_id }) compile (it could return an old, inactive rule). A vendor has many
// rule versions, so: drop that attribute from the Prisma schema (the index stays in the
// database and in the SQL migrations) and make the back-relation a list.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'schema.prisma');
let s = fs.readFileSync(file, 'utf8');
const before = s;

s = s.replace(
  /(\n  vendor_id\s+String\s+)@unique\(map: "point_rules_one_active_uq", where: raw\("is_active"\)\) /,
  '$1',
);
s = s.replace(/(\nmodel vendors \{[\s\S]*?\n  point_rules\s+)point_rules\?/, '$1point_rules[]');

if (s.includes('point_rules_one_active_uq')) {
  throw new Error('fix-introspection: point_rules partial unique still present; update this script');
}
fs.writeFileSync(file, s);
console.log(s === before ? 'fix-introspection: nothing to change' : 'fix-introspection: point_rules relation fixed');
