import swaggerJsdoc from 'swagger-jsdoc';
import { env } from '@config/env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'KHD-IT-SUP API',
      version: '1.0.0',
      description:
        'IT Service Desk & Asset Maintenance Management System — สำนักงานสาธารณสุขจังหวัดนครราชสีมา\n\n' +
        'สร้างอัตโนมัติจาก JSDoc annotation ในไฟล์ routes.ts ของทุก module (source of truth เดียวกับโค้ดจริง)',
      contact: { name: 'IT Department, Nakhon Ratchasima Provincial Public Health Office' },
    },
    servers: [{ url: env.API_PREFIX, description: 'Current environment' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/modules/**/routes.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
