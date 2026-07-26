import { Router } from 'express';
import * as workflowController from '@modules/workflow/controllers/workflow.controller';
import { authenticate } from '@common/middleware';

const router = Router();
router.use(authenticate);

/**
 * @openapi
 * /workflow-templates/{code}:
 *   get:
 *     tags: [Workflow]
 *     summary: โครงสร้างผังงาน (steps + transitions) สำหรับ render Timeline/Kanban ฝั่ง frontend
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:code', workflowController.getTemplateStructure);

export default router;
