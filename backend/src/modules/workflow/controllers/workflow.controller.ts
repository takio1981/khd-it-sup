import type { Request, Response } from 'express';
import { workflowService } from '@modules/workflow/services/workflow.service';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendSuccess } from '@common/utils/apiResponse';

export const getTemplateStructure = asyncHandler(async (req: Request, res: Response) => {
  const template = await workflowService.getTemplateStructure(req.params.code);
  sendSuccess(res, template);
});
