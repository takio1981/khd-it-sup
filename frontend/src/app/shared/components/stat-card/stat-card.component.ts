import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { KhdNumberPipe } from '../../pipes/khd-number.pipe';

export type StatCardColor = 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'teal' | 'gray';

const COLOR_HEX: Record<StatCardColor, string> = {
  blue: '#1F6FD1',
  green: '#2F853D',
  amber: '#D97706',
  red: '#DC2626',
  purple: '#7C3AED',
  teal: '#0F8F86',
  gray: '#64728A',
};

/**
 * KPI tile — 2 รูปแบบ:
 * - variant="icon" (ค่าเริ่มต้น): การ์ดพื้นผิวปกติ + ชิปไอคอนสี accentColor
 * - variant="solid": การ์ดพื้นสีอ่อนตาม color ตัวเลขเป็นสีเดียวกัน ใช้แถวสรุปที่ต้องแยกกลุ่มด้วยสี
 */
@Component({
  selector: 'khd-stat-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, KhdNumberPipe],
  host: { class: 'block' },
  template: `
    @if (variant() === 'solid') {
      <div
        class="flex h-full items-center gap-3 rounded-2xl border border-solid p-4"
        [style.background-color]="hex() + '12'"
        [style.border-color]="hex() + '30'"
      >
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface" [style.color]="hex()">
          <khd-icon [name]="icon()" [size]="22" />
        </div>
        <div class="min-w-0">
          <p class="m-0 text-2xl font-semibold leading-tight tabular-nums" [style.color]="hex()">{{ value() | khdNumber }}</p>
          <p class="m-0 truncate text-[13px] text-muted">{{ label() }}</p>
        </div>
      </div>
    } @else {
      <div class="khd-card flex h-full items-center gap-3 !p-4">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          [style.background-color]="accentColor() + '1A'"
          [style.color]="accentColor()"
        >
          <khd-icon [name]="icon()" [size]="22" />
        </div>
        <div class="min-w-0">
          <p class="m-0 text-2xl font-semibold leading-tight tabular-nums text-ink">{{ value() | khdNumber }}</p>
          <p class="m-0 truncate text-[13px] text-muted">{{ label() }}</p>
        </div>
      </div>
    }
  `,
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number | string>();
  readonly icon = input<string>('chart-bar');
  readonly accentColor = input<string>('#1F6FD1');
  readonly variant = input<'icon' | 'solid'>('icon');
  readonly color = input<StatCardColor>('blue');

  readonly hex = computed(() => COLOR_HEX[this.color()]);
}
