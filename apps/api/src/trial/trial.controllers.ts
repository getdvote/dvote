import { Body, Controller, HttpCode, Param, Post, Req, UnauthorizedException, UseGuards, ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConflictResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import type { Request } from 'express';
import { AdminApi } from '../auth/admin-api.decorator';
import { bearerToken } from '../auth/bearer-token';
import { SupabaseJwtVerifier, type SupabaseClaims } from '../auth/supabase-jwt.verifier';
import { ParseUuidPipe } from '../common/uuid';
import { LIMITS, UserLimit } from '../rate-limit/rate-limit';
import { BILLING_CYCLES, PLANS, type BillingCycle, type Plan } from '../plans/plans';
import { TrialService } from './trial.service';

export class SignupDto {
  @IsString() @MinLength(2) @MaxLength(120) shopName: string;
  @IsString() @MinLength(2) @MaxLength(120) ownerName: string;
  @IsString() @MaxLength(20) phone: string;
}

export class StartSignupDto {
  @IsString() @MinLength(2) @MaxLength(120) ownerName: string;
  @IsString() @MinLength(2) @MaxLength(120) shopName: string;
  @IsEmail() @MaxLength(255) email: string;
  @IsString() @MinLength(8) @MaxLength(72) password: string;
  @IsString() @MaxLength(20) phone: string;
  /** Cloudflare Turnstile token from the page. */
  @IsOptional() @IsString() @MaxLength(4096) captchaToken?: string;
  /** Where the confirmation link lands (must be allowed in Supabase's Redirect URLs). */
  @IsOptional() @IsUrl({ require_tld: false, protocols: ['http', 'https'] }) redirectTo?: string;
  /** The plan picked on dvote.co/pricing (kept on the trial shop; nothing is charged). */
  @IsOptional() @IsIn(PLANS) plan?: Plan;
  @IsOptional() @IsIn(BILLING_CYCLES) billingCycle?: BillingCycle;
}

export class PlanActionDto {
  @IsIn(['activate', 'extend', 'renew']) action: 'activate' | 'extend' | 'renew';
  @ValidateIf((o: PlanActionDto) => o.action === 'activate') @IsIn(PLANS) plan?: Plan;
  /** Activate only; default monthly. */
  @IsOptional() @IsIn(BILLING_CYCLES) billingCycle?: BillingCycle;
  /** Activate only: take (true) or give back (false) a Founding Merchant spot; left out = unchanged. */
  @IsOptional() @IsBoolean() founding?: boolean;
  @ValidateIf((o: PlanActionDto) => o.action === 'extend') @Type(() => Number) @IsInt() @Min(1) @Max(60) days?: number;
}

interface SignupRequest extends Request {
  claims: SupabaseClaims;
}

/** Any confirmed email + password Supabase account (no staff row needed yet). */
@Injectable()
class SignupAuthGuard implements CanActivate {
  constructor(private readonly verifier: SupabaseJwtVerifier) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<SignupRequest>();
    const token = bearerToken(req);
    if (!token) throw new UnauthorizedException({ code: 'missing_token' });
    const claims = await this.verifier.verify(token);
    if (claims.is_anonymous) throw new ForbiddenException({ code: 'provider_not_allowed' });
    req.claims = claims;
    return true;
  }
}

/**
 * POST /api/vendor/signup: the merchant dashboard's sign-up (merchant.dvote.co/signup) after the
 * email is confirmed. Creates the shop on a 14-day free trial; the account becomes its merchant admin.
 */
@ApiTags('vendor: sign-up')
@ApiBearerAuth()
@Controller('vendor/signup')
@UseGuards(SignupAuthGuard)
export class SignupController {
  constructor(private readonly trial: TrialService) {}

  @Post()
  @HttpCode(200)
  @UserLimit(LIMITS.join)
  @ApiOkResponse({ description: '{vendorId, trialEndsAt, deleteAt}' })
  @ApiConflictResponse({ description: 'account_already_staff | email_taken' })
  signup(@Req() req: SignupRequest, @Body() dto: SignupDto) {
    return this.trial.signup(req.claims, dto);
  }
}

/**
 * POST /api/public/merchant-signup (no sign-in, captcha, 5 / minute per IP): creates the
 * unconfirmed account and sends the confirmation email. Step 2 is POST /api/vendor/signup.
 */
@ApiTags('public: merchant sign-up')
@Controller('public/merchant-signup')
export class PublicSignupController {
  constructor(private readonly trial: TrialService) {}

  @Post()
  @HttpCode(200)
  @UserLimit(LIMITS.signup)
  @ApiOkResponse({ description: '{sent: true}' })
  @ApiConflictResponse({ description: 'email_taken' })
  start(@Req() req: Request, @Body() dto: StartSignupDto) {
    return this.trial.startSignup(dto, req.ip);
  }
}

/** POST /api/admin/vendors/{id}/plan: activate a paid plan, renew the paid period, or extend a free trial. */
@AdminApi('admin: plans')
@Controller('admin/vendors')
export class AdminPlanController {
  constructor(private readonly trial: TrialService) {}

  @Post(':id/plan')
  @HttpCode(200)
  @ApiBody({ type: PlanActionDto })
  @ApiConflictResponse({ description: 'not_on_trial | founding_full | not_active' })
  async plan(@Param('id', ParseUuidPipe) id: string, @Body() dto: PlanActionDto) {
    const v =
      dto.action === 'activate'
        ? await this.trial.activate(id, dto.plan as Plan, dto.billingCycle, dto.founding)
        : dto.action === 'renew'
          ? await this.trial.renew(id)
          : await this.trial.extend(id, dto.days as number);
    return {
      planStatus: v.plan_status,
      plan: v.plan,
      billingCycle: v.billing_cycle,
      founding: v.founding,
      paidUntil: v.paid_until?.toISOString() ?? null,
      nextPlan: v.next_plan,
      nextBillingCycle: v.next_billing_cycle,
      trialEndsAt: v.trial_ends_at?.toISOString() ?? null,
      deleteAt: v.delete_at?.toISOString() ?? null,
      status: v.status,
    };
  }
}
