export interface IApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: IPaginationMeta;
}

export interface IApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface IPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface IPaginatedResult<T> {
  items: T[];
  meta: IPaginationMeta;
}
