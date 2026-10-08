import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Env } from '../config/env.validation';

export interface AuthAccount {
  /** Supabase Auth user id (auth.users.id). */
  authUserId: string;
  /**
   * true when the email already had a Supabase account (e.g. they signed in to the app
   * with Google). No email is sent; they use that existing login.
   */
  existing: boolean;
}

/**
 * Server-side Supabase Auth admin calls (needs the SECRET key, never exposed to clients).
 * Tests replace this provider with a fake, so they never call Supabase.
 */
@Injectable()
export class SupabaseAdminService {
  private readonly logger = new Logger(SupabaseAdminService.name);
  private readonly client: SupabaseClient | null;
  private readonly inviteRedirectUrl: string | undefined;

  constructor(config: ConfigService<Env, true>) {
    const url = config.get('SUPABASE_URL', { infer: true });
    const secret = config.get('SUPABASE_SECRET_KEY', { infer: true })?.trim();
    this.client = secret
      ? createClient(url, secret, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null;

    const port = config.get('PORT', { infer: true });
    this.inviteRedirectUrl =
      config.get('STAFF_INVITE_REDIRECT_URL', { infer: true }) ??
      (config.get('NODE_ENV', { infer: true }) === 'production'
        ? undefined // falls back to the Supabase project's Site URL
        : `http://localhost:${port}/dev/staff.html`);
  }

  /** False when SUPABASE_SECRET_KEY is missing: account creation would fail. */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /** Emails an invite (the person sets their own password), or reuses an existing account. */
  async inviteUser(email: string): Promise<AuthAccount> {
    const admin = this.admin();
    const { data, error } = await admin.inviteUserByEmail(email, {
      redirectTo: this.inviteRedirectUrl,
    });
    if (!error) return { authUserId: data.user.id, existing: false };
    if (isEmailExists(error)) return this.existingAccount(email);
    throw this.failed('invite', error);
  }

  /** Creates a confirmed account with a password, no email sent. For local bootstrap only. */
  async createUserWithPassword(
    email: string,
    password: string,
  ): Promise<AuthAccount> {
    const admin = this.admin();
    const { data, error } = await admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (!error) return { authUserId: data.user.id, existing: false };
    if (isEmailExists(error)) return this.existingAccount(email);
    throw this.failed('create user', error);
  }

  /** Looks up the id of an existing account. generateLink returns the user without emailing. */
  private async existingAccount(email: string): Promise<AuthAccount> {
    const { data, error } = await this.admin().generateLink({
      type: 'magiclink',
      email,
    });
    if (error || !data.user) throw this.failed('look up user', error);
    return { authUserId: data.user.id, existing: true };
  }

  private admin(): SupabaseClient['auth']['admin'] {
    if (!this.client) {
      throw new ServiceUnavailableException({
        code: 'auth_admin_not_configured',
        message: 'SUPABASE_SECRET_KEY is not set on the server',
      });
    }
    return this.client.auth.admin;
  }

  /**
   * Turns a Supabase Auth error into an API error. Supabase's own message is passed
   * through (it is generic, e.g. "Email rate limit exceeded") so callers know what to fix.
   */
  private failed(action: string, error: unknown): HttpException {
    const e = (error ?? {}) as {
      message?: string;
      code?: string;
      status?: number;
    };
    const message = e.message ?? String(error);
    this.logger.error(
      `Supabase ${action} failed: ${e.status ?? ''} ${e.code ?? ''} ${message}`,
    );
    if (e.code === 'over_email_send_rate_limit' || e.status === 429) {
      return new HttpException(
        {
          code: 'email_rate_limited',
          message:
            'Supabase email limit reached (built-in sender: a few emails per hour). ' +
            'Wait, or configure your own SMTP in Supabase → Authentication → Emails.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return new ServiceUnavailableException({
      code: 'auth_provider_error',
      message: `Supabase ${action} failed: ${message}`,
    });
  }
}

function isEmailExists(error: unknown): boolean {
  const e = error as { code?: string; message?: string };
  return (
    e.code === 'email_exists' ||
    /already (been )?registered/i.test(e.message ?? '')
  );
}
