/** Role codes — ต้องตรงกับ `roles.code` ใน database/seed.sql เสมอ */
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  IT_OFFICER: 'IT_OFFICER',
  TECHNICIAN: 'TECHNICIAN',
  USER: 'USER',
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];
