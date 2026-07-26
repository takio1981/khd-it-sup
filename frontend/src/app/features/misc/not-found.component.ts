import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'khd-not-found',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="min-h-screen flex flex-col items-center justify-center gap-3 bg-brand-background dark:bg-neutral-950 px-4 text-center">
      <khd-icon name="exclamation-triangle" [size]="56" class="text-amber-500" />
      <h1 class="text-xl font-semibold">ไม่พบหน้าที่ต้องการ (404)</h1>
      <p class="text-neutral-500 text-sm">ลิงก์นี้อาจไม่ถูกต้องหรือถูกย้ายไปแล้ว</p>
      <a routerLink="/dashboard" class="text-brand-primary text-sm font-medium hover:underline">กลับสู่แดชบอร์ด</a>
    </div>
  `,
})
export class NotFoundComponent {}
