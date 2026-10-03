import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTVerifyGetKey,
  SignJWT,
} from 'jose';

const KID = 'test-key';

/**
 * Signs tokens shaped like Supabase access tokens with a local test key.
 * Override the app's SUPABASE_JWKS provider with `jwks` so the API trusts them.
 */
export interface TestSigner {
  jwks: JWTVerifyGetKey;
  sign(sub: string, claims?: Record<string, unknown>): Promise<string>;
}

export async function createTestSigner(): Promise<TestSigner> {
  const { publicKey, privateKey } = await generateKeyPair('ES256', {
    extractable: true,
  });
  const jwk = { ...(await exportJWK(publicKey)), kid: KID, alg: 'ES256' };
  const issuer = `${process.env.SUPABASE_URL}/auth/v1`; // set by test/setup-env.ts

  return {
    jwks: createLocalJWKSet({ keys: [jwk] }),
    sign: (sub, claims = {}) =>
      new SignJWT({
        role: 'authenticated',
        is_anonymous: false,
        app_metadata: { provider: 'email', providers: ['email'] },
        ...claims,
      })
        .setProtectedHeader({ alg: 'ES256', kid: KID })
        .setSubject(sub)
        .setIssuer(issuer)
        .setAudience('authenticated')
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey),
  };
}
