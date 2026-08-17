import type { Request, Response } from 'express';
import { searchService } from '@modules/search/services/search.service';
import type { GlobalSearchQueryDto } from '@modules/search/dto/search.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendSuccess } from '@common/utils/apiResponse';
import type { IRequestContext } from '@common/interfaces';

function contextOf(req: Request): IRequestContext {
  return { user: req.user!, ipAddress: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? 'unknown' };
}

export const globalSearch = asyncHandler(async (req: Request, res: Response) => {
  const { q } = req.query as unknown as GlobalSearchQueryDto;
  const result = await searchService.search(q, contextOf(req));
  sendSuccess(res, result);
});
