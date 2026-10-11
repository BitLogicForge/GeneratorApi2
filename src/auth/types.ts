/** A user identity returned only after verifying an API access token. */
export interface AuthenticatedUser {
  tenantId: string;
  objectId: string;
}

export interface AuthenticationOptions {
  tenantId: string;
  /** Validate signature, issuer, audience, lifetime and tenant before returning claims. */
  verifyAccessToken(token: string): Promise<AuthenticatedUser>;
}
