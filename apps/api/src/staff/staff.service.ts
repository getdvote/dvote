import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type staff_role,
  type staff_users,
} from '../generated/prisma/client.js';
import type { StaffContext } from '../auth/staff-auth.guard';
import { fromMinor, toMinor } from '../points/points';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseAdminService } from '../supabase/supabase-admin.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { ListStaffQueryDto } from './dto/list-staff-query.dto';
import { StaffMeResponseDto } from './dto/staff-me-response.dto';
import { StaffResponseDto } from './dto/staff-response.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

/**
 * Staff management for /api/vendor/staff.
 *
 * Who can do what:
 * - vendor_admin: everyone in their vendor (any role, any branch), but not their own
 *   role/branch/status (so a vendor can't lock itself out).
 * - branch_manager: only `staff` in their own branch; can't change role or branch.
 * - staff: no access (the controller rejects them).
 */
@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authAdmin: SupabaseAdminService,
  ) {}

  list(ctx: StaffContext, query: ListStaffQueryDto): Promise<staff_users[]> {
    return this.prisma.staff_users.findMany({
      where: {
        AND: [
          scope(ctx),
          {
            branch_id: query.branchId,
            role: query.role,
            status: query.status,
          },
        ],
      },
      orderBy: [{ created_at: 'asc' }],
    });
  }

  /** The signed-in staff member plus their vendor, branch(es) and active point rule. */
  async me(ctx: StaffContext): Promise<StaffMeResponseDto> {
    const [staff, vendor, branches, rule] = await Promise.all([
      this.get(ctx, ctx.staffId),
      this.prisma.vendors.findUniqueOrThrow({ where: { id: ctx.vendorId } }),
      this.prisma.branches.findMany({
        where: {
          vendor_id: ctx.vendorId,
          status: 'active',
          ...(ctx.branchId ? { id: ctx.branchId } : {}),
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.point_rules.findFirst({
        where: { vendor_id: ctx.vendorId, is_active: true },
      }),
    ]);
    return {
      ...StaffResponseDto.from(staff),
      vendor: {
        id: vendor.id,
        name: vendor.name,
        logoUrl: vendor.logo_url,
        currency: vendor.currency,
      },
      branch: ctx.branchId
        ? (branches.find((b) => b.id === ctx.branchId) ?? null)
        : null,
      branches,
      activeRule: rule
        ? {
            version: rule.version,
            spendAmount: fromMinor(toMinor(rule.spend_amount)),
            pointsPerSpend: rule.points_per_spend,
            minPurchase: fromMinor(toMinor(rule.min_purchase)),
            maxPointsPerPurchase: rule.max_points_per_purchase,
          }
        : null,
    };
  }

  async get(ctx: StaffContext, id: string): Promise<staff_users> {
    const staff = await this.prisma.staff_users.findFirst({
      where: { AND: [scope(ctx), { id }] },
    });
    // Same 404 whether it doesn't exist or belongs to another vendor/branch.
    if (!staff) throw new NotFoundException({ code: 'staff_not_found' });
    return staff;
  }

  async create(
    ctx: StaffContext,
    dto: CreateStaffDto,
  ): Promise<{ staff: staff_users; invited: boolean }> {
    let branchId = dto.branchId ?? null;
    if (ctx.role === 'branch_manager') {
      if (dto.role !== 'staff') {
        throw new ForbiddenException({ code: 'forbidden_role' });
      }
      branchId ??= ctx.branchId;
      if (branchId !== ctx.branchId) {
        throw new ForbiddenException({ code: 'forbidden_branch' });
      }
    }
    await this.assertRoleBranch(ctx.vendorId, dto.role, branchId);
    return this.insert(ctx.vendorId, {
      name: dto.name,
      email: dto.email,
      role: dto.role,
      branchId,
    });
  }

  async update(
    ctx: StaffContext,
    id: string,
    dto: UpdateStaffDto,
  ): Promise<staff_users> {
    const target = await this.get(ctx, id);

    const changesAccess =
      dto.role !== undefined ||
      dto.branchId !== undefined ||
      dto.status !== undefined;
    if (target.id === ctx.staffId && changesAccess) {
      throw new ForbiddenException({ code: 'cannot_modify_self' });
    }

    if (ctx.role === 'branch_manager') {
      if (target.role !== 'staff') {
        throw new ForbiddenException({ code: 'forbidden_role' });
      }
      const movesRole = dto.role !== undefined && dto.role !== target.role;
      const movesBranch =
        dto.branchId !== undefined && dto.branchId !== target.branch_id;
      if (movesRole || movesBranch) {
        throw new ForbiddenException({ code: 'forbidden_role_change' });
      }
    }

    const role = dto.role ?? target.role;
    let branchId: string | null;
    if (role === 'vendor_admin') {
      if (dto.branchId !== undefined) {
        throw new BadRequestException({ code: 'branch_not_allowed' });
      }
      branchId = null;
    } else {
      branchId = dto.branchId ?? target.branch_id;
    }
    if (role !== target.role || branchId !== target.branch_id) {
      await this.assertRoleBranch(ctx.vendorId, role, branchId);
    }

    return this.prisma.staff_users.update({
      where: { id: target.id },
      data: { name: dto.name, role, branch_id: branchId, status: dto.status },
    });
  }

  /** Platform admin: every staff account of a vendor (admins first, then by name). */
  async listForVendor(vendorId: string): Promise<staff_users[]> {
    const vendor = await this.prisma.vendors.findUnique({ where: { id: vendorId }, select: { id: true } });
    if (!vendor) throw new NotFoundException({ code: 'vendor_not_found' });
    return this.prisma.staff_users.findMany({
      where: { vendor_id: vendorId },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
  }

  /** Platform admin: rename, or disable / re-enable a staff account (soft delete). */
  async adminUpdate(id: string, dto: Pick<UpdateStaffDto, 'name' | 'status'>): Promise<staff_users> {
    const found = await this.prisma.staff_users.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException({ code: 'staff_not_found' });
    return this.prisma.staff_users.update({ where: { id }, data: { name: dto.name, status: dto.status } });
  }

  /**
   * Adds a vendor_admin to a vendor on behalf of the platform (not a staff member):
   * POST /api/admin/vendors/{id}/admins. Sends an invite email (or links an existing account).
   */
  async createVendorAdmin(input: {
    vendorId: string;
    name: string;
    email: string;
  }): Promise<{ staff: staff_users; invited: boolean }> {
    const vendor = await this.prisma.vendors.findUnique({
      where: { id: input.vendorId },
    });
    if (!vendor) throw new NotFoundException({ code: 'vendor_not_found' });
    return this.insert(vendor.id, {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      role: 'vendor_admin',
      branchId: null,
    });
  }

  /** Links (or invites) the Supabase account, then creates the staff row. */
  private async insert(
    vendorId: string,
    s: {
      name: string;
      email: string;
      role: staff_role;
      branchId: string | null;
    },
  ): Promise<{ staff: staff_users; invited: boolean }> {
    // Check before inviting so we don't email someone we then fail to add.
    const taken = await this.prisma.staff_users.findFirst({
      where: { email: { equals: s.email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (taken) throw new ConflictException({ code: 'email_taken' });

    const account = await this.authAdmin.inviteUser(s.email);

    try {
      const staff = await this.prisma.staff_users.create({
        data: {
          vendor_id: vendorId,
          branch_id: s.branchId,
          name: s.name,
          email: s.email,
          role: s.role,
          auth_user_id: account.authUserId,
        },
      });
      return { staff, invited: !account.existing };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const target = JSON.stringify(err.meta ?? {});
        throw new ConflictException({
          code: target.includes('auth_user_id')
            ? 'account_already_staff'
            : 'email_taken',
        });
      }
      throw err;
    }
  }

  /** vendor_admin has no branch; branch roles need an active branch of this vendor. */
  private async assertRoleBranch(
    vendorId: string,
    role: staff_role,
    branchId: string | null,
  ): Promise<void> {
    if (role === 'vendor_admin') {
      if (branchId)
        throw new BadRequestException({ code: 'branch_not_allowed' });
      return;
    }
    if (!branchId) throw new BadRequestException({ code: 'branch_required' });
    const branch = await this.prisma.branches.findFirst({
      where: { id: branchId, vendor_id: vendorId, status: 'active' },
      select: { id: true },
    });
    if (!branch) throw new BadRequestException({ code: 'invalid_branch' });
  }
}

/** Tenant scoping: every query is limited to the caller's vendor (and branch for branch roles). */
function scope(ctx: StaffContext): Prisma.staff_usersWhereInput {
  return ctx.role === 'vendor_admin'
    ? { vendor_id: ctx.vendorId }
    : { vendor_id: ctx.vendorId, branch_id: ctx.branchId };
}
