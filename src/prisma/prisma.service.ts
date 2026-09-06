import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DB_POOL_MAX || 20),
      idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT || 30_000),
      connectionTimeoutMillis: Number(
        process.env.DB_POOL_CONN_TIMEOUT || 5_000,
      ),
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    const connStr = process.env.DATABASE_URL || '';
    const isLocal =
      connStr.includes('localhost') || connStr.includes('127.0.0.1');
    const target = isLocal
      ? 'DESENVOLVIMENTO LOCAL (localhost:5432/sinalizego_dev)'
      : 'PRODUÇÃO (Supabase)';
    this.logger.log(`Conexão com o banco estabelecida: [${target}]`);
  }
}
