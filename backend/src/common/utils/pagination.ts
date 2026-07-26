import type { IPaginatedResult, IPaginationQuery } from '@common/interfaces';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface INormalizedPagination {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

/** แปลง query param ดิบ (string | undefined) ให้เป็นค่าตัวเลขที่ปลอดภัยสำหรับ Prisma skip/take */
export function normalizePagination(query: IPaginationQuery): INormalizedPagination {
  const page = Math.max(1, Number(query.page) || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || DEFAULT_LIMIT));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  pagination: INormalizedPagination,
): IPaginatedResult<T> {
  return {
    items,
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
    },
  };
}
