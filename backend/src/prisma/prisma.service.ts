import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private get transactionMaxWaitMs(): number {
    const value = Number(process.env.PRISMA_TX_MAX_WAIT_MS ?? '10000');
    return Number.isFinite(value) && value > 0 ? value : 10000;
  }

  private get transactionTimeoutMs(): number {
    const value = Number(process.env.PRISMA_TX_TIMEOUT_MS ?? '20000');
    return Number.isFinite(value) && value > 0 ? value : 20000;
  }

  private get shouldSkipConnection(): boolean {
    return process.env.NODE_ENV === 'test' && !process.env.DATABASE_URL;
  }

  async onModuleInit(): Promise<void> {
    if (this.shouldSkipConnection) {
      return;
    }
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.shouldSkipConnection) {
      return;
    }
    await this.$disconnect();
  }

  async withOrg<T>(orgId: string, action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, true)`;
      return action(tx);
    }, {
      maxWait: this.transactionMaxWaitMs,
      timeout: this.transactionTimeoutMs,
    });
  }
}
