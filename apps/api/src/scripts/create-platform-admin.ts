/**
 * Creates a platform admin (your team) — there is no API for this on purpose.
 *
 *   npm run admin:create -- --name "Karim" --email karim@example.com --password "<pw>"
 *       → creates the Supabase account (no email) and the platform_admins row.
 *   (without --password → sends a Supabase invite email instead)
 *
 * /api/admin requires a two-factor (authenticator app) sign-in, i.e. an aal2 token,
 * unless ADMIN_MFA_REQUIRED=false (local development only).
 */
import { parseArgs } from 'node:util';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseAdminService } from '../supabase/supabase-admin.service';

async function main() {
  const { values } = parseArgs({
    options: {
      name: { type: 'string' },
      email: { type: 'string' },
      password: { type: 'string' },
    },
  });
  if (!values.name || !values.email) {
    console.error(
      'Usage: npm run admin:create -- --name "<name>" --email <email> [--password <pw>]',
    );
    process.exit(1);
  }
  const email = values.email.trim().toLowerCase();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const prisma = app.get(PrismaService);
    const taken = await prisma.platform_admins.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (taken) throw new Error(`${email} is already a platform admin`);

    const authAdmin = app.get(SupabaseAdminService);
    if (!authAdmin.isConfigured()) {
      throw new Error(
        'SUPABASE_SECRET_KEY is not set in apps/api/.env (needed to create the login account).',
      );
    }
    const account = values.password
      ? await authAdmin.createUserWithPassword(email, values.password)
      : await authAdmin.inviteUser(email);

    const admin = await prisma.platform_admins.create({
      data: {
        name: values.name.trim(),
        email,
        auth_user_id: account.authUserId,
      },
    });
    console.log(`Created platform admin ${admin.email} (id ${admin.id}).`);
    if (account.existing) {
      console.warn(
        'WARNING: this email already had a Supabase account (e.g. Google or a customer sign-up), ' +
          'so no new password was set. If that account has no password (Google-only), password ' +
          'sign-in will fail: use a separate address instead, e.g. yourname+admin@gmail.com.',
      );
    } else {
      console.log(
        values.password
          ? 'Sign in with this email and password (Postman: Auth > Admin sign in).'
          : 'Invite email sent: open the link to set a password.',
      );
    }
  } catch (err) {
    const body = (err as { response?: unknown }).response;
    console.error(
      'Failed:',
      body ? JSON.stringify(body) : (err as Error).message,
    );
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main();
