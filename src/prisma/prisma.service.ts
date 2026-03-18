import 'dotenv/config';
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

// Shared database service used by all modules via Nest DI.
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // Uses DATABASE_URL from env; falls back to local dev connection for convenience.
    const connectionString =
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/imtihon5?schema=public';

    // Prisma adapter runs over a pg Pool for efficient connection reuse.
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    super({
      adapter,

      // Keep runtime logs focused on actionable issues.
      log: ['error', 'warn'],
    });
  }

  async onModuleInit() {
    try {
      // Connect once at startup.
      await this.$connect();
      this.logger.log('Successfully connected to database');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    // Gracefully close DB pool on shutdown.
    await this.$disconnect();
    this.logger.log('Disconnected from database');
  }

  async cleanDatabase() {
    // Safety guard: never truncate tables in production.
    if (process.env.NODE_ENV === 'production') return;

    // Deletes rows from all Prisma models for local reset/testing.
    const models = Reflect.ownKeys(this).filter((key) => key[0] !== '_');

    return Promise.all(models.map((modelKey) => this[modelKey].deleteMany()));
  }
}
