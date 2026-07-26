import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** ป้องกัน route ที่ต้อง login — ใช้ร่วมกับ provideAppInitializer(silentRefresh) ที่ทำงานก่อน router activate เสมอ */
export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
};

/** กันไม่ให้ผู้ที่ login แล้วย้อนกลับไปหน้า login ซ้ำ */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/dashboard']);
};

/** บังคับให้ผู้ใช้ที่ mustChangePassword=true ไปเปลี่ยนรหัสผ่านก่อนใช้งานหน้าอื่นในระบบ */
export const mustChangePasswordGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.currentUser()?.mustChangePassword) {
    return router.createUrlTree(['/auth/change-password']);
  }
  return true;
};
