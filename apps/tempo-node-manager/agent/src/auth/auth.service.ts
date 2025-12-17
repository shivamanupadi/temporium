import { Injectable, UnauthorizedException, Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { LoginResponse, SetupStatus, JwtPayload } from '#types/index';

interface AdminConfig {
  passwordHash: string;
  createdAt: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private configPath: string;
  private adminConfig: AdminConfig | null = null;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService
  ) {
    // Use local path for development, /etc for production
    const defaultPath =
      process.env.NODE_ENV === 'production'
        ? '/etc/tempo-node-manager/config.json'
        : path.join(process.cwd(), '.data', 'config.json');

    this.configPath = this.configService.get<string>('CONFIG_PATH', defaultPath);
  }

  async onModuleInit() {
    await this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        this.adminConfig = JSON.parse(data);
        this.logger.log('Admin configuration loaded');
      } else {
        this.logger.warn('No admin configuration found - setup required');
      }
    } catch (error) {
      this.logger.error('Error loading config:', error);
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.adminConfig, null, 2));
      this.logger.log('Admin configuration saved');
    } catch (error) {
      this.logger.error('Error saving config:', error);
      throw new Error('Failed to save configuration');
    }
  }

  async getSetupStatus(): Promise<SetupStatus> {
    return {
      isSetup: this.adminConfig !== null,
      requiresPassword: this.adminConfig === null,
    };
  }

  async setup(password: string): Promise<LoginResponse> {
    if (this.adminConfig !== null) {
      throw new UnauthorizedException('Already setup');
    }

    if (!password || password.length < 8) {
      throw new UnauthorizedException('Password must be at least 8 characters');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    this.adminConfig = {
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    await this.saveConfig();

    return this.generateToken();
  }

  async login(password: string): Promise<LoginResponse> {
    if (this.adminConfig === null) {
      throw new UnauthorizedException('Setup required');
    }

    const isValid = await bcrypt.compare(password, this.adminConfig.passwordHash);

    if (!isValid) {
      throw new UnauthorizedException('Invalid password');
    }

    return this.generateToken();
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    if (this.adminConfig === null) {
      throw new UnauthorizedException('Setup required');
    }

    const isValid = await bcrypt.compare(currentPassword, this.adminConfig.passwordHash);

    if (!isValid) {
      throw new UnauthorizedException('Invalid current password');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new UnauthorizedException('New password must be at least 8 characters');
    }

    const saltRounds = 10;
    this.adminConfig.passwordHash = await bcrypt.hash(newPassword, saltRounds);
    await this.saveConfig();
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
