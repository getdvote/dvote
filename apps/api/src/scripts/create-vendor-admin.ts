/**
 * Creates a vendor's FIRST vendor_admin (nobody exists yet to invite them).
 * Temporary until the platform-admin API exists.
 *
 *   npm run staff:create-admin -- --vendor <vendorId> --name "Owner" --email owner@shop.com
 *       → sends a Supabase invite email; they set their password from the link.
 *   ... --password "<temp password>"
 *       → creates the account directly, no email (handy for local testing).
 */
import { parseArgs } from 'node:util';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { StaffService } from '../staff/staff.service';

async function main() {
  const { values } = parseArgs({
    options: {
      vendor: { type: 'string' },
      name: { type: 'string' },
      email: { type: 'string' },
      password: { type: 'string' },
    },
  });
  if (!values.vendor || !values.name || !values.email) {
    console.error(
      'Usage: npm run staff:create-admin -- --vendor <vendorId> --name "<name>" --email <email> [--password <pw>]',
    );
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const { staff, invited } = await app
      .get(StaffService)
      .bootstrapVendorAdmin({
        vendorId: values.vendor,
        name: values.name,
        email: values.email,
        password: values.password,
      });
    console.log(`Created vendor_admin ${staff.email} (staff id ${staff.id}).`);
    console.log(
      values.password
        ? 'Account created with the given password: sign in on the staff test page.'
        : invited
          ? 'Invite email sent: open the link to set a password.'
          : 'This email already had an account (e.g. Google): sign in with that.',
    );
  } catch (err) {
    const body = (err as { response?: unknown }).response;
    console.error('Failed:', body ? JSON.stringify(body) : err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main();
