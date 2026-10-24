import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { IconComponent } from '../icon/icon.component';

/**
 * แถบตัวกรองของหน้ารายการ — ลูกตัวแรก (มักเป็นช่องค้นหา) แสดงเสมอ ส่วนตัวกรองที่เหลือบนมือถือจะพับเก็บไว้
 * หลังปุ่ม "ตัวกรองเพิ่มเติม" เพื่อไม่ให้ตัวกรองหลายช่องกินพื้นที่เต็มจอก่อนถึงข้อมูล (จอใหญ่แสดงครบเสมอ)
 */
@Component({
  selector: 'khd-filter-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, IconComponent],
  host: { class: 'block' },
  template: `
    <div class="khd-filter-bar" [class.khd-filter-collapsed]="collapsed()">
      <ng-content />
      @if (extra() > 0) {
        <button mat-button type="button" class="khd-filter-toggle sm:!hidden" (click)="collapsed.set(!collapsed())">
          <khd-icon name="funnel" [size]="16" class="mr-1.5" />
          {{ collapsed() ? 'ตัวกรองเพิ่มเติม' + (extra() > 1 ? ' (' + extra() + ')' : '') : 'ซ่อนตัวกรอง' }}
        </button>
      }
    </div>
  `,
})
export class FilterBarComponent {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly collapsed = signal(true);
  readonly extra = signal(0);

  constructor() {
    afterNextRender(() => {
      const bar = this.el.nativeElement.querySelector('.khd-filter-bar');
      const count = bar ? Array.from(bar.children).filter((c) => !c.classList.contains('khd-filter-toggle')).length : 0;
      this.extra.set(Math.max(0, count - 1));
    });
  }
}
