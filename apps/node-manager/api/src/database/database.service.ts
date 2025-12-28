import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  // Admin config methods
  async getAdminConfig(): Promise<{ passwordHash: string; createdAt: Date } | null> {
    const config = await this.adminConfig.findUnique({
      where: { id: 1 },
    });
    if (!config) return null;
    return {
      passwordHash: config.passwordHash,
      createdAt: config.createdAt,
    };
  }

  async setAdminConfig(passwordHash: string): Promise<void> {
    await this.adminConfig.upsert({
      where: { id: 1 },
      update: { passwordHash },
      create: { id: 1, passwordHash },
    });
  }

  async isAdminConfigured(): Promise<boolean> {
    const count = await this.adminConfig.count();
    return count > 0;
  }

  // Generic settings methods
  async getSetting(key: string): Promise<string | null> {
    const setting = await this.setting.findUnique({
      where: { key },
    });
    return setting?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  async deleteSetting(key: string): Promise<void> {
    await this.setting.deleteMany({
      where: { key },
    });
  }
}
