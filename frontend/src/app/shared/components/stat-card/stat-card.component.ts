import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { KhdNumberPipe } from '../../pipes/khd-number.pipe';

export type StatCardColor = 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'teal' | 'gray';

const SOLID_CLASSES: Record<StatCardColor, string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-400 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700',
  amber: 'bg-amber-50 text-amber-700 border-amber-400 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700',
  red: 'bg-rose-50 text-rose-700 border-rose-400 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700',
  purple: 'bg-violet-50 text-violet-700 border-violet-400 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-700',
  teal: 'bg-teal-50 text-teal-700 border-teal-400 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-700',
  gray: 'bg-neutral-100 text-neutral-600 border-neutral-400 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-600',
};

/**
 * KPI tile — รองรับ 2 รูปแบบ:
 * - variant="icon" (ค่าเริ่มต้น): การ์ดขาว + ไอคอนสี ใช้ในแดชบอร์ดภาพรวม
 * - variant="solid": การ์ดพื้นสีพาสเทลเต็ม ตัวเลขใหญ่ตรงกลาง ใช้กับหน้าที่ต้องการความคลีน/สแกนอ่านง่าย (เช่น จัดการผู้ใช้งาน)
 */
@Component({
  selector: 'khd-stat-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, KhdNumberPipe],
  template: `
    @if (variant() === 'solid') {
      <div
        class="relative overflow-hidden rounded-2xl px-5 py-5 flex flex-col items-center justify-center text-center gap-0 transition-transform hover:-translate-y-0.5 border-0 border-solid border-t-4 border-r-4"
        [class]="solidClasses()"
      >
        <div class="absolute inset-0 flex items-center justify-end opacity-15 pointer-events-none">
          <khd-icon [name]="icon()" [size]="180" class="!translate-x-10" />
        </div>
        <div class="relative z-10 flex flex-col items-center gap-0">
          <p class="m-0 text-5xl font-bold leading-none tabular-nums">{{ value() | khdNumber }}</p>
          <p class="m-0 mt-1 text-xs font-medium leading-tight">{{ label() }}</p>
        </div>
      </div>
    } @else {
      <div class="khd-card flex items-center gap-4">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" [style.background-color]="accentColor() + '1A'">
          <khd-icon [name]="icon()" [size]="24" [style.color]="accentColor()" />
        </div>
        <div class="min-w-0">
          <p class="text-2xl font-semibold leading-tight tabular-nums">{{ value() | khdNumber }}</p>
          <p class="text-sm text-neutral-500 truncate">{{ label() }}</p>
        </div>
      </div>
    }
  `,
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number | string>();
  readonly icon = input<string>('chart-bar');
  readonly accentColor = input<string>('#006C45');
  readonly variant = input<'icon' | 'solid'>('icon');
  readonly color = input<StatCardColor>('blue');

  readonly solidClasses = computed(() => SOLID_CLASSES[this.color()]);
}
