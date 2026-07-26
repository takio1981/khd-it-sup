import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { env } from '@config/env';
import { swaggerSpec } from '@config/swagger.config';
import { authenticate, errorHandler, globalRateLimiter, notFoundHandler, requestLogger } from '@common/middleware';
import { requestId } from '@common/middleware/requestLogger';

import authRoutes from '@modules/auth/routes';
import userRoutes from '@modules/users/routes';
import departmentRoutes from '@modules/departments/routes';
import positionRoutes from '@modules/positions/routes';
import divisionRoutes from '@modules/divisions/routes';
import locationRoutes from '@modules/locations/routes';
import assetRoutes from '@modules/assets/routes';
import qrcodeRoutes from '@modules/qrcode/routes';
import repairTicketRoutes from '@modules/repair-tickets/routes';
import workflowRoutes from '@modules/workflow/routes';
import notificationRoutes from '@modules/notifications/routes';
import settingsRoutes from '@modules/settings/routes';
import dashboardRoutes from '@modules/dashboard/routes';
import { serveFile } from '@infrastructure/storage/serveFile.controller';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // อยู่หลัง Nginx reverse proxy เสมอ — จำเป็นสำหรับ req.ip และ rate limiter ที่ถูกต้อง

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());
  app.use(requestId);
  app.use(requestLogger);
  app.use(env.API_PREFIX, globalRateLimiter);

  app.get('/health', (_req, res) => {
    res.status(200).json({ success: true, data: { status: 'ok', service: env.APP_NAME, time: new Date().toISOString() } });
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: `${env.APP_NAME} API Docs` }));
  app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));

  const api = express.Router();
  api.use('/auth', authRoutes);
  api.use('/users', userRoutes);
  api.use('/departments', departmentRoutes);
  api.use('/positions', positionRoutes);
  api.use('/divisions', divisionRoutes);
  api.use('/', locationRoutes);
  api.use('/assets', assetRoutes);
  api.use('/qrcodes', qrcodeRoutes);
  api.use('/repair-tickets', repairTicketRoutes);
  api.use('/workflow-templates', workflowRoutes);
  api.use('/notifications', notificationRoutes);
  api.use('/settings', settingsRoutes);
  api.use('/dashboard', dashboardRoutes);
  api.get('/files/:subdir/:filename', authenticate, serveFile);
  app.use(env.API_PREFIX, api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
