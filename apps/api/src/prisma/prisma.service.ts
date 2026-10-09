import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { Env } from '../config/env.validation';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService<Env, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('DATABASE_URL', { infer: true }),
        // The pg adapter sends and reads timestamps without a UTC offset, so the session
        // must be UTC or every Prisma-written time is shifted by the server's timezone
        // (e.g. Africa/Cairo = 3 h) while DB defaults like now() are not.
        options: '-c TimeZone=UTC',
        // Small pool: Supabase limits pooler clients (15 in session mode on the Free plan), and
        // several developers' APIs may share one project. Use the transaction pooler (6543).
        max: 5,
        idleTimeoutMillis: 30_000,
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
