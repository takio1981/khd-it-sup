import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'khd-forbidden',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule],
  template: `
    <div class="flex min-h-screen flex-col items-center justify-center bg-brand-background px-4 text-center">
      <span class="mb-5 flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-white shadow-softLg">
        <img src="illust/security.webp" alt="" class="h-full w-full object-cover" />
      </span>
      <p class="m-0 text-sm font-semibold tracking-wide text-red-600">403</p>
      <h1 class="m-0 mt-1 text-2xl font-semibold">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
      <p class="m-0 mt-2 max-w-md text-sm text-muted">
        บัญชีของคุณไม่มีสิทธิ์เพียงพอสำหรับหน้านี้ กรุณาติดต่อผู้ดูแลระบบหากคิดว่าเป็นข้อผิดพลาด
      </p>
      <div class="mt-6 flex flex-wrap justify-center gap-2">
        <a mat-flat-button routerLink="/repair-tickets">ไปที่งานแจ้งซ่อม</a>
        <a mat-stroked-button routerLink="/help">คู่มือการใช้งาน</a>
      </div>
    </div>
  `,
})
export class ForbiddenComponent {}
