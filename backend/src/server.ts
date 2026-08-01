import http from 'node:http';
import { createApp } from './app';
import { env } from '@config/env';
import { logger } from '@infrastructure/logger/logger';
import { connectDatabase, disconnectDatabase } from '@infrastructure/database/prisma';
import { initializeSocketServer } from '@infrastructure/socket/socket.server';
import { startScheduledJobs } from '@infrastructure/scheduler/scheduler';

async function bootstrap(): Promise<void> {
  await connectDatabase();

  const app = createApp();
  const httpServer = http.createServer(app);
  initializeSocketServer(httpServer);
  startScheduledJobs();

  httpServer.listen(env.PORT, () => {
    logger.info(`🚀 ${env.APP_NAME} backend listening on port ${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`📄 Swagger UI: http://localhost:${env.PORT}/api-docs`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — shutting down gracefully...`);
    httpServer.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    // บังคับปิดหากค้างเกิน 10 วินาที (เช่น connection ที่ไม่ยอมปิด)
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error(`❌ Failed to start server: ${err instanceof Error ? err.stack : String(err)}`);
  process.exit(1);
});
