import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/** สถานะกำลังโหลดมาตรฐาน */
@Component({
  selector: 'khd-loading-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatProgressSpinnerModule],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col items-center justify-center gap-3 py-12 text-sm text-muted" role="status">
      <mat-spinner [diameter]="32" [strokeWidth]="3" />
      <span>{{ label() }}</span>
    </div>
  `,
})
export class LoadingStateComponent {
  readonly label = input('กำลังโหลดข้อมูล…');
}
