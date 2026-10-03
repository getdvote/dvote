import { plainToInstance, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export class Env {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @IsInt()
  @Min(1)
  @Max(65535)
  @Type(() => Number)
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  /**
   * Supabase project URL, e.g. https://abcd1234.supabase.co (or http://127.0.0.1:54321 locally).
   * Only the public URL: tokens are checked against the project's public signing keys (JWKS).
   */
  @IsUrl({ require_tld: false, require_protocol: true })
  SUPABASE_URL: string;

  /**
   * Supabase SECRET key (sb_secret_... or legacy service_role). Server-only: used to
   * invite staff. Optional (empty = unset) so the API boots without it; staff invites
   * return 503 until set.
   */
  @IsOptional()
  @IsString()
  SUPABASE_SECRET_KEY?: string;

  /**
   * Where the staff invite email link lands (the dashboard's set-password page).
   * Must be listed in Supabase → Authentication → URL Configuration → Redirect URLs.
   * Defaults to the dev test page outside production.
   */
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  STAFF_INVITE_REDIRECT_URL?: string;

  /** Comma-separated list of allowed origins; unset = CORS disabled. */
  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;
}

/** Fails fast at boot if the environment is missing or malformed. */
export function validateEnv(config: Record<string, unknown>): Env {
  const env = plainToInstance(Env, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map(
        (e) =>
          `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
      )
      .join('; ');
    throw new Error(`Invalid environment: ${details}`);
  }
  return env;
}
