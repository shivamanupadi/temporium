import { Injectable, UnauthorizedException, Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginResponse, SetupStatus, JwtPayload } from '#types/index';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private databaseService: DatabaseService
  ) {}

  async onModuleInit() {
    const isConfigured = await this.databaseService.isAdminConfigured();
    if (isConfigured) {
      this.logger.log('Admin configuration loaded from database');
    } else {
      this.logger.warn('No admin configuration found - setup required');
    }
  }

  async getSetupStatus(): Promise<SetupStatus> {
    const isConfigured = await this.databaseService.isAdminConfigured();
    return {
      isSetup: isConfigured,
      requiresPassword: !isConfigured,
    };
  }

  async setup(password: string): Promise<LoginResponse> {
    if (await this.databaseService.isAdminConfigured()) {
      throw new UnauthorizedException('Already setup');
    }

    if (!password || password.length < 8) {
      throw new UnauthorizedException('Password must be at least 8 characters');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    await this.databaseService.setAdminConfig(passwordHash);
    this.logger.log('Admin configuration saved to database');

    return this.generateToken();
  }

  async login(password: string): Promise<LoginResponse> {
    const adminConfig = await this.databaseService.getAdminConfig();
    if (!adminConfig) {
      throw new UnauthorizedException('Setup required');
    }

    const isValid = await bcrypt.compare(password, adminConfig.passwordHash);

    if (!isValid) {
      throw new UnauthorizedException('Invalid password');
    }

    return this.generateToken();
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const adminConfig = await this.databaseService.getAdminConfig();
    if (!adminConfig) {
      throw new UnauthorizedException('Setup required');
    }

    const isValid = await bcrypt.compare(currentPassword, adminConfig.passwordHash);

    if (!isValid) {
      throw new UnauthorizedException('Invalid current password');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new UnauthorizedException('New password must be at least 8 characters');
    }

    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
    await this.databaseService.setAdminConfig(newPasswordHash);
    this.logger.log('Admin password updated in database');
  }

  private generateToken(): LoginResponse {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: 'admin',
      role: 'admin',
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      expiresIn: 24 * 60 * 60, // 24 hours in seconds
    };
  }

  validateToken(token: string): JwtPayload {
    try {
      return this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
