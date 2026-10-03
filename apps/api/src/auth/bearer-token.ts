import type { Request } from 'express';

/** The token from an `Authorization: Bearer <token>` header, if present. */
export function bearerToken(req: Request): string | undefined {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}
