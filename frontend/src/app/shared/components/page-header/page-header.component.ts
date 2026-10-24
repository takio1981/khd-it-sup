import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../icon/icon.component';

/**
 * ส่วนหัวมาตรฐานของทุกหน้าใน shell — ชื่อหน้า + คำอธิบาย + ปุ่มด้านขวา
 * ใช้งาน: <khd-page-header title="..." subtitle="..." backLink="/assets"><button actions ...></khd-page-header>
 */
@Component({
  selector: 'khd-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div class="flex min-w-0 items-start gap-2">
        @if (backLink(); as link) {
          <a
            [routerLink]="link"
            class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-neutral-500/10 hover:text-ink"
            [attr.aria-label]="backLabel()"
          >
            <khd-icon name="arrow-left" [size]="20" />
          </a>
        }
        <div class="min-w-0">
          <h1 class="m-0 text-[22px] font-semibold leading-tight text-ink">{{ title() }}</h1>
          @if (subtitle()) {
            <p class="m-0 mt-1 text-sm text-muted">{{ subtitle() }}</p>
          }
          <ng-content select="[meta]" />
        </div>
      </div>
      <div class="khd-page-actions flex flex-wrap items-center gap-2">
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    .khd-page-actions:empty { display: none; }
    .khd-page-actions ::ng-deep .mat-mdc-button-base { white-space: nowrap; }
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly backLink = input<string | unknown[] | null>(null);
  readonly backLabel = input('ย้อนกลับ');
}
