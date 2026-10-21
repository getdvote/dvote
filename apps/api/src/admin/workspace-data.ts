import {
  Controller,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AdminApi } from '../auth/admin-api.decorator';
import { IsUuid } from '../common/uuid';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';

class WorkspaceQuery {
  @IsOptional() @IsUuid() vendorId?: string;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
}

// These are fixed, reviewed SQL projections, never user-provided table/column names.
const VIEWS: Record<string, string> = {
  branches: `SELECT id,vendor_id,name,coalesce(address,'') AS detail,status::text AS status,NULL::int AS points,NULL::text AS amount,created_at FROM branches`,
  rewards: `SELECT id,vendor_id,name,coalesce(description,'') AS detail,status::text AS status,points_cost AS points,NULL::text AS amount,created_at FROM rewards`,
  team: `SELECT s.id,s.vendor_id,s.name,s.email||' · '||replace(s.role::text,'vendor_admin','merchant admin')||' · '||coalesce(b.name,'All branches') AS detail,s.status::text AS status,NULL::int AS points,NULL::text AS amount,s.created_at FROM staff_users s LEFT JOIN branches b ON b.id=s.branch_id`,
  members: `SELECT c.id,c.vendor_id,u.name,coalesce(u.phone,u.email,'') AS detail,u.status::text AS status,c.balance AS points,NULL::text AS amount,c.created_at FROM cards c JOIN users u ON u.id=c.user_id`,
  activity: `SELECT e.id,e.vendor_id,e.type::text AS name,coalesce(b.name,'All branches')||' · '||coalesce(s.name,a.name,'System') AS detail,e.type::text AS status,e.delta AS points,e.purchase_amount::text AS amount,e.created_at FROM point_events e LEFT JOIN branches b ON b.id=e.branch_id LEFT JOIN staff_users s ON s.id=e.staff_id LEFT JOIN platform_admins a ON a.id=e.created_by`,
  redemptions: `SELECT r.id,r.vendor_id,r.reward_name AS name,coalesce(b.name,'') AS detail,'redeemed'::text AS status,r.points_cost AS points,NULL::text AS amount,r.created_at FROM redemptions r JOIN branches b ON b.id=r.branch_id`,
  broadcast: `SELECT b.id,b.vendor_id,b.title AS name,b.body AS detail,CASE WHEN EXISTS(SELECT 1 FROM wallet_broadcast_recipients r WHERE r.broadcast_id=b.id AND r.status IN ('pending','processing')) THEN 'sending'
      WHEN EXISTS(SELECT 1 FROM wallet_broadcast_recipients r WHERE r.broadcast_id=b.id AND r.status IN ('failed','unknown')) THEN 'needs review'
      ELSE 'completed' END AS status,(SELECT count(*)::int FROM wallet_broadcast_recipients r WHERE r.broadcast_id=b.id AND r.status='accepted') AS points,NULL::text AS amount,b.created_at FROM wallet_broadcasts b WHERE b.audience->>'type' IS DISTINCT FROM 'redemption'`,
  'customer-feedback': `SELECT f.id,f.vendor_id,f.name,f.message AS detail,'received'::text AS status,NULL::int AS points,NULL::text AS amount,f.created_at FROM vendor_feedback f`,
  audit: `SELECT l.id,l.vendor_id,a.name AS name,l.method||' '||l.path AS detail,l.status,NULL::int AS points,NULL::text AS amount,l.created_at FROM admin_actions l JOIN platform_admins a ON a.id=l.admin_id`,
  storefront: `SELECT id,id AS vendor_id,name,slug||' · '||coalesce(page_style,'spotlight') AS detail,status::text AS status,NULL::int AS points,NULL::text AS amount,created_at FROM vendors`,
  card: `SELECT v.id,v.id AS vendor_id,v.name,'Design '||coalesce(v.card_design::text,'automatic') AS detail,v.status::text AS status,(SELECT coalesce(sum(balance),0)::int FROM cards c WHERE c.vendor_id=v.id) AS points,NULL::text AS amount,v.created_at FROM vendors v`,
  insights: `SELECT v.id,v.id AS vendor_id,v.name,((SELECT count(*) FROM point_events e WHERE e.vendor_id=v.id AND e.type='earn' AND e.created_at>=now()-interval '30 days')::text||' collects in 30 days') AS detail,v.status::text AS status,(SELECT count(*)::int FROM cards c WHERE c.vendor_id=v.id) AS points,(SELECT coalesce(sum(purchase_amount),0)::text FROM point_events e WHERE e.vendor_id=v.id AND e.type='earn' AND e.created_at>=now()-interval '30 days') AS amount,v.created_at FROM vendors v`,
};
VIEWS['merchant-home'] = VIEWS.insights;
VIEWS.scan = VIEWS.storefront;
VIEWS.settings = VIEWS.storefront;
VIEWS.kit = VIEWS.storefront;

@Injectable()
export class AdminWorkspaceDataService {
  constructor(private readonly db: PrismaService) {}
  async list(section: string, q: WorkspaceQuery) {
    const source = VIEWS[section];
    if (!source) throw new NotFoundException({ code: 'page_not_found' });
    const term = q.search?.trim();
    const where = Prisma.sql`WHERE true ${q.vendorId ? Prisma.sql`AND d.vendor_id=${q.vendorId}::uuid` : Prisma.empty}
      ${term ? Prisma.sql`AND (d.name ILIKE ${`%${term}%`} OR d.detail ILIKE ${`%${term}%`} OR v.name ILIKE ${`%${term}%`})` : Prisma.empty}`;
    const [counts, items] = await Promise.all([
      this.db.$queryRaw<
        { total: number }[]
      >`SELECT count(*)::int AS total FROM (${Prisma.raw(source)}) d JOIN vendors v ON v.id=d.vendor_id ${where}`,
      this.db.$queryRaw<
        Record<string, unknown>[]
      >`SELECT d.*,v.name AS vendor_name,v.currency FROM (${Prisma.raw(source)}) d JOIN vendors v ON v.id=d.vendor_id ${where}
        ORDER BY d.created_at DESC,d.id LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
    ]);
    return {
      items: items.map((r) => ({
        id: r.id,
        vendorId: r.vendor_id,
        vendorName: r.vendor_name,
        currency: r.currency,
        name: r.name,
        detail: r.detail,
        status: r.status,
        points: r.points,
        amount: r.amount,
        createdAt: r.created_at,
      })),
      total: counts[0].total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }
}

@AdminApi('admin: system-wide workspace')
@Controller('admin/workspace')
export class AdminWorkspaceDataController {
  constructor(private readonly data: AdminWorkspaceDataService) {}
  @Get(':section') list(
    @Param('section') section: string,
    @Query() q: WorkspaceQuery,
  ) {
    return this.data.list(section, q);
  }
}
