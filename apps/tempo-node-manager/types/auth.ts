/**
 * Login request
 */
export interface LoginRequest {
  password: string;
}

/**
 * Login response
 */
export interface LoginResponse {
  accessToken: string;
  expiresIn: number; // seconds
}

/**
 * JWT payload
 */
export interface JwtPayload {
  sub: string; // 'admin'
  role: 'admin';
  iat: number;
  exp: number;
}

/**
 * Change password request
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * Setup status (for first-time setup)
 */
export interface SetupStatus {
  isSetup: boolean;
  requiresPassword: boolean;
}
