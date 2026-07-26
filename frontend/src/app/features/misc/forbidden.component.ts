import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'khd-forbidden',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="min-h-screen flex flex-col items-center justify-center gap-3 bg-brand-background dark:bg-neutral-950 px-4 text-center">
      <khd-icon name="shield-check" [size]="56" class="text-red-500" />
      <h1 class="text-xl font-semibold">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
      <p class="text-neutral-500 text-sm">บัญชีของคุณไม่มีสิทธิ์เพียงพอสำหรับหน้านี้ กรุณาติดต่อผู้ดูแลระบบหากคิดว่าเป็นข้อผิดพลาด</p>
      <a routerLink="/dashboard" class="text-brand-primary text-sm font-medium hover:underline">กลับสู่แดชบอร์ด</a>
    </div>
  `,
})
export class ForbiddenComponent {}
