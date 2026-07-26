import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { getStatusColor, getStatusLabel } from '../../../core/constants/status.const';

/** ป้ายสถานะสีตาม workflow step code — ใช้ซ้ำใน Ticket list, Timeline, Kanban */
@Component({
  selector: 'khd-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="khd-status-badge" [style.background-color]="color() + '1A'" [style.color]="color()">
      {{ label() }}
    </span>
  `,
})
export class StatusBadgeComponent {
  readonly status = input.required<string>();

  readonly color = computed(() => getStatusColor(this.status()));
  readonly label = computed(() => getStatusLabel(this.status()));
}
