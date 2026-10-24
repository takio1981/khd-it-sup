import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { IconComponent } from '../icon/icon.component';

/** ปุ่ม "ส่งออก" มาตรฐาน (Excel / CSV / PDF) — ซ่อนรูปแบบที่ไม่มี listener ได้ด้วย [formats] */
@Component({
  selector: 'khd-export-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatMenuModule, IconComponent],
  template: `
    <button mat-stroked-button [matMenuTriggerFor]="menu" [disabled]="disabled()">
      <khd-icon name="arrow-down-tray" [size]="18" class="mr-1.5" />
      {{ disabled() ? 'กำลังส่งออก…' : label() }}
    </button>
    <mat-menu #menu="matMenu" xPosition="before">
      @if (formats().includes('excel')) {
        <button mat-menu-item (click)="excel.emit()">
          <khd-icon name="document-text" [size]="18" class="mr-3 text-[#1d6f42]" />Excel (.xlsx)
        </button>
      }
      @if (formats().includes('csv')) {
        <button mat-menu-item (click)="csv.emit()">
          <khd-icon name="document-text" [size]="18" class="mr-3 text-muted" />CSV
        </button>
      }
      @if (formats().includes('pdf')) {
        <button mat-menu-item (click)="pdf.emit()">
          <khd-icon name="document-text" [size]="18" class="mr-3 text-[#c2410c]" />PDF
        </button>
      }
    </mat-menu>
  `,
})
export class ExportMenuComponent {
  readonly disabled = input(false);
  readonly label = input('ส่งออก');
  readonly formats = input<readonly ('excel' | 'csv' | 'pdf')[]>(['excel', 'csv', 'pdf']);
  readonly excel = output<void>();
  readonly csv = output<void>();
  readonly pdf = output<void>();
}
