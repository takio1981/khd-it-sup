import type { IAuthUser } from '@common/interfaces/index';

declare global {
  namespace Express {
    interface Request {
      user?: IAuthUser;
    }
  }
}

export {};
