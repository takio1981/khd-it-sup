import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ICONS } from './icon.data';

/**
 * HeroIcon inline renderer — ใช้ path data จริงจากแพ็กเกจ heroicons (24x24 outline)
 * ใช้งาน: <khd-icon name="qr-code" class="w-5 h-5 text-white" />
 */
@Component({
  selector: 'khd-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.viewBox]="'0 0 24 24'"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      [attr.width]="size()"
      [attr.height]="size()"
      aria-hidden="true"
    >
      @for (d of paths(); track d) {
        <path [attr.d]="d" />
      }
    </svg>
  `,
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input<number>(24);
  readonly strokeWidth = input<number>(1.5);

  readonly paths = computed(() => ICONS[this.name()] ?? []);
}
