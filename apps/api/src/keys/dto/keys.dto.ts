/**
 * Keys module DTOs for WebAuthn/Passkey authentication
 */

/**
 * Response returned when a challenge is requested
 */
export class ChallengeResponseDto {
  challenge: string;
}

/**
 * Response from tempo.ts containing public key data
 */
export interface TempoPublicKeyResponse {
  publicKey?: string;
}

/**
 * Response returned after successful credential creation or authentication
 * Includes JWT token for subsequent API calls
 */
export class AuthenticatedCredentialResponseDto {
  /** The public key associated with this credential */
  publicKey: string;

  /** JWT access token for API authentication */
  accessToken: string;

  /** Token expiration time in seconds */
  expiresIn: number;
}

/**
 * Error response structure for keys endpoints
 */
export class KeysErrorResponseDto {
  /** HTTP status code */
  statusCode: number;

  /** Error message */
  message: string;

  /** Error type/code */
  error: string;

  /** Optional request path for debugging */
  path?: string;

  /** Timestamp of the error */
  timestamp: string;
}
