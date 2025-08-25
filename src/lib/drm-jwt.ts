// src/utils/drm-jwt.ts
import jwt from 'jsonwebtoken'

/** 
 * The shape of our entitlement token. 
 * - sub: the user’s unique ID 
 * - email: the user’s email (optional but often handy)
 * - course: which course code they’re allowed 
 * - kid_list: an array of KIDs (hex strings) they may play 
 */
export interface EntitlementPayload {
  sub: string
  email?: string
  course_code: string
  kid_list: string[]
  iat?: number
  exp?: number
  jti?: string
}

/** 
 * Signs a short-lived JWT (RS256, 5 min expiration) 
 */
export function signEntitlementJWT(payload: EntitlementPayload): string {
  // Read the private key from the environment
  const privateKey = process.env.DRM_JWT_PRIVATE_KEY!
  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: '5m', // token valid for 5 minutes
  })
}

/** 
 * Verifies a JWT and returns the payload. 
 * (This will be used in Phase 2 on the license server.) 
 */
export function verifyEntitlementJWT(token: string): EntitlementPayload {
  const publicKey = process.env.DRM_JWT_PUBLIC_KEY!
  return jwt.verify(token, publicKey) as EntitlementPayload
}
