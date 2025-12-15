import { Controller } from '@nestjs/common';

// Auth controller is minimal - JWT tokens are generated during passkey authentication
// in the Keys module. Token validation happens via JwtAuthGuard.
// No refresh tokens - when JWT expires, user re-authenticates with passkey.
@Controller({ path: 'auth', version: '1' })
export class AuthController {}
