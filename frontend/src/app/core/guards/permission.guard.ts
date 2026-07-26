import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import type { Permission } from '../models/auth.model';

/**
 * ตรวจสิทธิ์ตาม route data: { permissions: Permission[] } — ผ่านถ้ามีสิทธิ์อย่างน้อย 1 ใน list (OR logic)
 * ใช้คู่กับ authGuard เสมอ (permissionGuard ไม่เช็ค login ซ้ำ)
 */
export const permissionGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const required = (route.data['permissions'] as Permission[] | undefined) ?? [];
  if (required.length === 0 || authService.hasAnyPermission(required)) {
    return true;
  }

  return router.createUrlTree(['/forbidden']);
};
