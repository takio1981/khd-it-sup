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
import { corsOriginResolver } from '@common/utils/cors.util';

import authRoutes from '@modules/auth/routes';
import userRoutes from '@modules/users/routes';
import departmentRoutes from '@modules/departments/routes';
import positionRoutes from '@modules/positions/routes';
import divisionRoutes from '@modules/divisions/routes';
import locationRoutes from '@modules/locations/routes';
import assetRoutes from '@modules/assets/routes';
import assetLoanRoutes from '@modules/asset-loans/routes';
import qrcodeRoutes from '@modules/qrcode/routes';
import repairTicketRoutes from '@modules/repair-tickets/routes';
import workflowRoutes from '@modules/workflow/routes';
import notificationRoutes from '@modules/notifications/routes';
import settingsRoutes from '@modules/settings/routes';
import dashboardRoutes from '@modules/dashboard/routes';
import auditLogRoutes from '@modules/audit-log/routes';
import sparePartRoutes from '@modules/spare-parts/routes';
import vendorRoutes from '@modules/vendors/routes';
import vendorRepairOrderRoutes from '@modules/vendor-repair-orders/routes';
import documentRoutes from '@modules/documents/routes';
import searchRoutes from '@modules/search/routes';
import equipmentSyncRoutes from '@modules/equipment-sync/routes';
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
  app.use(cors({ origin: corsOriginResolver, credentials: true }));
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
  api.use('/assets', assetRoutes);
  api.use('/asset-loans', assetLoanRoutes);
  api.use('/qrcodes', qrcodeRoutes);
  api.use('/repair-tickets', repairTicketRoutes);
  api.use('/workflow-templates', workflowRoutes);
  api.use('/notifications', notificationRoutes);
  api.use('/settings', settingsRoutes);
  api.use('/dashboard', dashboardRoutes);
  api.use('/audit-logs', auditLogRoutes);
  api.use('/spare-parts', sparePartRoutes);
  api.use('/vendors', vendorRoutes);
  api.use('/vendor-repair-orders', vendorRepairOrderRoutes);
  api.use('/search', searchRoutes);
  api.use('/equipment-sync', equipmentSyncRoutes);
  // locationRoutes/documentRoutes mount ที่ root ('/') ต้องอยู่ท้ายสุดเสมอ — เพราะ Express จับคู่ prefix '/' กับทุก
  // request ที่ผ่าน api router จึงต้องให้ router ที่ระบุ path เจาะจง (เช่น /qrcodes) ถูกลองจับคู่ก่อนเสมอ ไม่งั้น
  // blanket `router.use(authenticate)` ภายใน locationRoutes จะดัก request ที่ยังไม่ login ทุกตัวไปก่อนถึง route
  // สาธารณะอย่าง GET /qrcodes/resolve/:token (ใช้ optionalAuthenticate) ทำให้กลายเป็นต้อง login เสมอทั้งที่ตั้งใจให้ public
  api.use('/', locationRoutes);
  api.use('/', documentRoutes);
  api.get('/files/:subdir/:filename', authenticate, serveFile);
  app.use(env.API_PREFIX, api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
