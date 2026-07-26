import { buildPaginatedResult, normalizePagination } from '@common/utils/pagination';

describe('normalizePagination', () => {
  it('ใช้ค่า default เมื่อไม่ระบุ page/limit', () => {
    const result = normalizePagination({});
    expect(result).toEqual({ page: 1, limit: 20, skip: 0, take: 20 });
  });

  it('คำนวณ skip ถูกต้องเมื่อระบุ page', () => {
    const result = normalizePagination({ page: 3, limit: 10 });
    expect(result).toEqual({ page: 3, limit: 10, skip: 20, take: 10 });
  });

  it('จำกัด limit สูงสุดไม่เกิน 100', () => {
    const result = normalizePagination({ limit: 500 });
    expect(result.limit).toBe(100);
  });

  it('ป้องกันค่า page ติดลบด้วยการปัดกลับเป็น 1', () => {
    const result = normalizePagination({ page: -5 });
    expect(result.page).toBe(1);
  });

  it('limit เป็น 0 หรือค่าที่ไม่ถูกต้อง ถือเป็นไม่ได้ระบุ จึงใช้ค่า default แทน', () => {
    const result = normalizePagination({ limit: 0 });
    expect(result.limit).toBe(20);
  });
});

describe('buildPaginatedResult', () => {
  it('คำนวณ totalPages ถูกต้องและปัดขึ้นเสมอ', () => {
    const pagination = normalizePagination({ page: 1, limit: 10 });
    const result = buildPaginatedResult(['a', 'b'], 25, pagination);
    expect(result.meta).toEqual({ page: 1, limit: 10, total: 25, totalPages: 3 });
    expect(result.items).toEqual(['a', 'b']);
  });

  it('totalPages อย่างน้อย 1 แม้ total เป็น 0', () => {
    const pagination = normalizePagination({});
    const result = buildPaginatedResult([], 0, pagination);
    expect(result.meta.totalPages).toBe(1);
  });
});
