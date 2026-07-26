import type { NextFunction, Request, Response } from 'express';

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * ห่อ async controller เพื่อส่ง Promise rejection เข้า Express error handler อัตโนมัติ
 * (Express 4 ไม่รองรับ async/await error propagation ให้เองโดยตรง)
 */
export function asyncHandler(handler: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}
