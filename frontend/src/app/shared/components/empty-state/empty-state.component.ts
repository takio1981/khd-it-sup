import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

export type KhdIllustration = 'repair' | 'workflow' | 'loan' | 'sync' | 'security';

/** สถานะ "ไม่มีข้อมูล" มาตรฐาน — ไอคอนหรือภาพประกอบ + หัวข้อ + คำอธิบาย + ปุ่ม (ng-content) */
@Component({
  selector: 'khd-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col items-center px-6 text-center" [class.py-12]="!compact()" [class.py-8]="compact()">
      @if (illustration(); as ill) {
        <span class="mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-white shadow-soft">
          <img [src]="'illust/' + ill + '.webp'" alt="" class="h-full w-full object-cover" />
        </span>
      } @else {
        <span class="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary">
          <khd-icon [name]="icon()" [size]="24" />
        </span>
      }
      <p class="m-0 text-[15px] font-semibold text-ink">{{ title() }}</p>
      @if (message()) {
        <p class="m-0 mt-1 max-w-sm text-sm text-muted">{{ message() }}</p>
      }
      <div class="mt-4 flex flex-wrap justify-center gap-2 empty:hidden"><ng-content /></div>
    </div>
  `,
})
export class EmptyStateComponent {
  readonly title = input('ไม่พบข้อมูล');
  readonly message = input<string | null>(null);
  readonly icon = input('inbox');
  readonly illustration = input<KhdIllustration | null>(null);
  readonly compact = input(false);
}
