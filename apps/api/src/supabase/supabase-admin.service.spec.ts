import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseAdminService } from './supabase-admin.service';

function serviceReturning(error: object) {
  const config = {
    get: (key: string) =>
      ({
        SUPABASE_URL: 'https://test-project.supabase.co',
        SUPABASE_SECRET_KEY: 'sb_secret_test',
        PORT: 3000,
        NODE_ENV: 'test',
      })[key],
  } as unknown as ConfigService;
  const service = new SupabaseAdminService(config as never);
  // Replace the real Supabase client: no network in unit tests.
  (service as unknown as { client: unknown }).client = {
    auth: {
      admin: {
        inviteUserByEmail: () => Promise.resolve({ data: null, error }),
      },
    },
  };
  return service;
}

describe('SupabaseAdminService errors', () => {
  it('email rate limit → 429 email_rate_limited', async () => {
    const service = serviceReturning({
      status: 429,
      code: 'over_email_send_rate_limit',
      message: 'Email rate limit exceeded',
    });
    const err = await service.inviteUser('a@b.co').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(429);
    expect((err as HttpException).getResponse()).toMatchObject({
      code: 'email_rate_limited',
    });
  });

  it("other failures → 503 auth_provider_error with Supabase's message", async () => {
    const service = serviceReturning({
      status: 500,
      code: 'unexpected_failure',
      message: 'Error sending invite email',
    });
    const err = await service.inviteUser('a@b.co').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect((err as HttpException).getResponse()).toMatchObject({
      code: 'auth_provider_error',
      message: 'Supabase invite failed: Error sending invite email',
    });
  });
});
