import 'dotenv/config';
import { Injectable, OnModuleInit, OnModuleDestroy, Logger, } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);
    constructor() {
        const connectionString = process.env.DATABASE_URL ||
            'postgresql://postgres:postgres@localhost:5432/imtihon5?schema=public';
        const pool = new Pool({ connectionString });
        const adapter = new PrismaPg(pool);
        super({
            adapter,
            log: ['error', 'warn'],
        });
    }
    async onModuleInit() {
        try {
            await this.$connect();
            this.logger.log('Successfully connected to database');
        }
        catch (error) {
            this.logger.error('Failed to connect to database', error);
            throw error;
        }
    }
    async onModuleDestroy() {
        await this.$disconnect();
        this.logger.log('Disconnected from database');
    }
    async cleanDatabase() {
        if (process.env.NODE_ENV === 'production')
            return;
        const models = Reflect.ownKeys(this).filter((key) => key[0] !== '_');
        return Promise.all(models.map((modelKey) => this[modelKey].deleteMany()));
    }
}
