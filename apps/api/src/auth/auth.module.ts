import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet } from 'jose';
import { Env } from '../config/env.validation';
import { UsersModule } from '../users/users.module';
import { CustomerAuthGuard } from './customer-auth.guard';
import { PlatformAdminGuard } from './platform-admin.guard';
import { StaffAuthGuard } from './staff-auth.guard';
import { SUPABASE_JWKS, SupabaseJwtVerifier } from './supabase-jwt.verifier';

@Module({
  imports: [UsersModule],
  providers: [
    {
      provide: SUPABASE_JWKS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const url = config
          .get('SUPABASE_URL', { infer: true })
          .replace(/\/+$/, '');
        return createRemoteJWKSet(
          new URL(`${url}/auth/v1/.well-known/jwks.json`),
        );
      },
    },
    SupabaseJwtVerifier,
    CustomerAuthGuard,
    StaffAuthGuard,
    PlatformAdminGuard,
  ],
  exports: [
    SupabaseJwtVerifier,
    CustomerAuthGuard,
    StaffAuthGuard,
    PlatformAdminGuard,
    UsersModule,
  ],
})
export class AuthModule {}
