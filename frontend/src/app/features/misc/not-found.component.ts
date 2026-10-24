import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'khd-not-found',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule],
  template: `
    <div class="flex min-h-screen flex-col items-center justify-center bg-brand-background px-4 text-center">
      <span class="mb-5 flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-white shadow-softLg">
        <img src="illust/sync.webp" alt="" class="h-full w-full object-cover" />
      </span>
      <p class="m-0 text-sm font-semibold tracking-wide text-brand-primary">404</p>
      <h1 class="m-0 mt-1 text-2xl font-semibold">ไม่พบหน้าที่ต้องการ</h1>
      <p class="m-0 mt-2 max-w-md text-sm text-muted">ลิงก์นี้อาจไม่ถูกต้องหรือถูกย้ายไปแล้ว</p>
      <div class="mt-6 flex flex-wrap justify-center gap-2">
        <a mat-flat-button routerLink="/">กลับหน้าหลัก</a>
      </div>
    </div>
  `,
})
export class NotFoundComponent {}
