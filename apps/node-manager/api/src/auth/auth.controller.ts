import { Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto, SetupDto, ChangePasswordDto } from './dto';
import { LoginResponse, SetupStatus } from '#types/index';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Get setup status - check if initial password has been set
   */
  @Get('status')
  async getStatus(): Promise<SetupStatus> {
    return this.authService.getSetupStatus();
  }

  /**
   * Initial setup - set admin password
   */
  @Post('setup')
  @HttpCode(HttpStatus.OK)
  async setup(@Body() dto: SetupDto): Promise<LoginResponse> {
    return this.authService.setup(dto.password);
  }

  /**
   * Login with password
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(dto.password);
  }

  /**
   * Change password (requires authentication)
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(@Body() dto: ChangePasswordDto): Promise<{ success: boolean }> {
    await this.authService.changePassword(dto.currentPassword, dto.newPassword);
    return { success: true };
  }

  /**
   * Verify current token is valid
   */
  @Get('verify')
  @UseGuards(JwtAuthGuard)
  async verify(): Promise<{ valid: boolean }> {
    return { valid: true };
  }
}
