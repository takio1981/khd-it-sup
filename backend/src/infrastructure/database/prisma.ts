import { Prisma, PrismaClient } from '@prisma/client';

/** ใช้เป็น type parameter ของ repository ที่ต้องรองรับการรันภายใน `prisma.$transaction(async (tx) => ...)` ได้ */
export type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;
import { isDevelopment } from '@config/env';
import { logger } from '@infrastructure/logger/logger';

/**
 * Prisma Client singleton — ป้องกันการเปิด connection pool ซ้ำซ้อนตอน `tsx watch` hot-reload ใน dev
 * (แนวทางมาตรฐานที่ Prisma แนะนำสำหรับ Node.js long-running process)
 */
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: isDevelopment
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ]
      : [{ emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }],
  });

if (isDevelopment) {
  global.__prisma = prisma;
  // @ts-expect-error -- Prisma event typing ต่างกันตาม log level ที่เลือก แต่ event 'query' ใช้ได้จริงตาม config ด้านบน
  prisma.$on('query', (e: { query: string; params: string; duration: number }) => {
    logger.debug(`[prisma] ${e.query} :: ${e.params} (${e.duration}ms)`);
  });
}

// @ts-expect-error -- ดูหมายเหตุด้านบน
prisma.$on('warn', (e: { message: string }) => logger.warn(`[prisma] ${e.message}`));
// @ts-expect-error -- ดูหมายเหตุด้านบน
prisma.$on('error', (e: { message: string }) => logger.error(`[prisma] ${e.message}`));

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info('✅ Database connected (MariaDB via Prisma)');
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('🛑 Database disconnected');
}

/** Convention: ตารางที่มี deleted_at (User, Asset) ต้องกรอง deletedAt: null ตรง ๆ ใน Repository ทุกเมธอด find */
export const NOT_DELETED = { deletedAt: null } as const;
