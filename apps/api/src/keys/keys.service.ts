import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Kv } from 'tempo.ts/server';

/**
 * Keys Service - Migrated from Cloudflare D1 Worker
 * Provides a tempo.ts compatible Kv interface backed by PostgreSQL
 */
@Injectable()
export class KeysService implements Kv.Kv {
  constructor(private prisma: PrismaService) {}

  /**
   * Get a value by key (credentialId)
   */
  async get<T = unknown>(key: string): Promise<T> {
    const result = await this.prisma.passkey.findUnique({
      where: { key },
    });

    if (!result) return undefined as T;

    try {
      return JSON.parse(result.value) as T;
    } catch {
      return result.value as T;
    }
  }

  /**
   * Set a value by key (store public key)
   */
  async set(key: string, value: unknown): Promise<void> {
    const serialized =
      typeof value === 'string' ? value : JSON.stringify(value);

    await this.prisma.passkey.upsert({
      where: { key },
      update: { value: serialized },
      create: { key, value: serialized },
    });
  }

  /**
   * Delete a key
   */
  async delete(key: string): Promise<void> {
    try {
      await this.prisma.passkey.delete({
        where: { key },
      });
    } catch {
      // Ignore if not found
    }
  }

  /**
   * Generate a random challenge for WebAuthn authentication
   */
  generateChallenge(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Buffer.from(array).toString('base64url');
  }
}
