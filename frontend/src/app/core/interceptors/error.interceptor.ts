import { inject } from '@angular/core';
import type { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * ดัก 401 → ลอง silent refresh หนึ่งครั้งแล้ว retry request เดิม ถ้า refresh ล้มเหลวให้เด้งไปหน้า login
 * error อื่น ๆ (403/404/409/422/500) แสดง snackbar ข้อความจาก backend (เป็นภาษาไทยอยู่แล้วตาม apiResponse format)
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);

  const isAuthEndpoint = req.url.includes('/auth/login') || req.url.includes('/auth/refresh');

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isAuthEndpoint) {
        return authService.refreshAccessToken().pipe(
          switchMap(() => next(req)),
          catchError(() => {
            void router.navigateByUrl('/auth/login');
            return throwError(() => error);
          }),
        );
      }

      if (error.status !== 401) {
        const message = error.error?.error?.message ?? 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบ';
        snackBar.open(message, 'ปิด', { duration: 4000, panelClass: ['khd-snackbar-error'] });
      }

      return throwError(() => error);
    }),
  );
};
