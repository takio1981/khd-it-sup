import type { Permission } from '@common/constants/permissions.const';
import type { RoleCode } from '@common/constants/roles.const';

export type Gender = 'MALE' | 'FEMALE';

/** Payload ที่ decode ได้จาก JWT Access Token และแนบไว้ที่ req.user */
export interface IAuthUser {
  id: string;
  username: string;
  fullName: string;
  role: RoleCode;
  permissions: Permission[];
  departmentId: string | null;
  mustChangePassword: boolean;
  avatarUrl: string | null;
  gender: Gender | null;
}

export interface IPaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface IPaginatedResult<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface IApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Context มาตรฐานที่ทุก Service ต้องรับสำหรับ audit log / permission check ภายใน business logic */
export interface IRequestContext {
  user: IAuthUser;
  ipAddress: string;
  userAgent: string;
}
