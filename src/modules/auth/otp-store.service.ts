import { Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { createClient } from 'redis';

@Injectable()
export class OtpStoreService implements OnModuleDestroy {
    private readonly logger = new Logger(OtpStoreService.name);
    private client: ReturnType<typeof createClient> | null = null;
    private connectingPromise: Promise<ReturnType<typeof createClient>> | null = null;

    async setJson(key: string, payload: unknown, ttlSeconds: number): Promise<void> {
        const client = await this.getClient();
        await client.set(key, JSON.stringify(payload), {
            EX: ttlSeconds,
        });
    }

    async getJson<T>(key: string): Promise<T | null> {
        const client = await this.getClient();
        const value = await client.get(key);
        if (!value) {
            return null;
        }

        try {
            return JSON.parse(value) as T;
        } catch {
            await this.delete(key);
            return null;
        }
    }

    async delete(key: string): Promise<void> {
        const client = await this.getClient();
        await client.del(key);
    }

    async onModuleDestroy(): Promise<void> {
        if (this.client?.isOpen) {
            await this.client.quit();
        }
    }

    private async getClient(): Promise<ReturnType<typeof createClient>> {
        if (this.client?.isOpen) {
            return this.client;
        }

        if (this.connectingPromise) {
            return this.connectingPromise;
        }

        const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
        const client = createClient({
            url: redisUrl,
        });

        client.on('error', (error) => {
            this.logger.error('Redis client error', error as Error);
        });

        this.connectingPromise = client
            .connect()
            .then(() => {
                this.logger.log(`Connected to Redis at ${redisUrl}`);
                this.client = client;
                this.connectingPromise = null;
                return client;
            })
            .catch((error) => {
                this.connectingPromise = null;
                this.logger.error('Failed to connect to Redis', error as Error);
                throw new ServiceUnavailableException('OTP xizmati vaqtincha ishlamayapti (Redis ulanmagan)');
            });

        return this.connectingPromise;
    }
}
