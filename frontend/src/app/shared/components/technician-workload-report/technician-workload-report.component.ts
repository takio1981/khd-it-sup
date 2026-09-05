import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { UserService, type ITechnicianWorkload } from '../../../core/services/user.service';
import { StatCardComponent } from '../stat-card/stat-card.component';
import { KhdNumberPipe } from '../../pipes/khd-number.pipe';

/**
 * รายงานภาระงานช่างเทคนิค/เจ้าหน้าที่ไอที (เปรียบเทียบ workload + สถานะว่าง/ไม่ว่าง)
 * ดึงข้อมูลเอง — ใช้ฝังได้ทั้งในแดชบอร์ดและหน้ารายงาน โดยไม่ต้องส่ง input
 */
@Component({
  selector: 'khd-technician-workload-report',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatCardComponent, KhdNumberPipe],
  template: `
    <div class="pt-4 space-y-4">
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl">
        <khd-stat-card variant="solid" color="blue" icon="users" label="ช่าง/ไอททั้งหมด" [value]="workload().length" />
        <khd-stat-card variant="solid" color="green" icon="check-circle" label="ว่าง" [value]="availableCount()" />
        <khd-stat-card variant="solid" color="red" icon="x-circle" label="ไม่ว่าง" [value]="busyCount()" />
      </div>

      <div class="khd-card !p-0 overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-black/5 dark:border-white/10 text-left text-xs text-neutral-500">
              <th class="px-4 py-2.5 font-medium">ชื่อ-นามสกุล</th>
              <th class="px-4 py-2.5 font-medium">สิทธิ์</th>
              <th class="px-4 py-2.5 font-medium">งานที่ยังไม่ปิด</th>
              <th class="px-4 py-2.5 font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            @for (t of workloadSorted(); track t.id) {
              <tr class="border-b border-black/5 dark:border-white/10 last:border-0">
                <td class="px-4 py-2.5">{{ t.fullName }}</td>
                <td class="px-4 py-2.5 text-neutral-500">{{ t.role.nameTh }}</td>
                <td class="px-4 py-2.5">{{ t.activeTicketCount | khdNumber }}</td>
                <td class="px-4 py-2.5">
                  <span
                    class="khd-status-badge"
                    [style.background-color]="(t.availability === 'AVAILABLE' ? '#22C55E' : '#EF4444') + '1A'"
                    [style.color]="t.availability === 'AVAILABLE' ? '#22C55E' : '#EF4444'"
                  >
                    {{ t.availability === 'AVAILABLE' ? 'ว่าง' : 'ไม่ว่าง' }}
                  </span>
                </td>
              </tr>
            }
            @if (workload().length === 0) {
              <tr>
                <td colspan="4" class="px-4 py-8 text-center text-neutral-400">ไม่มีข้อมูลช่างเทคนิค/เจ้าหน้าที่ไอที</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class TechnicianWorkloadReportComponent {
  private readonly userService = inject(UserService);

  readonly workload = signal<ITechnicianWorkload[]>([]);
  readonly availableCount = computed(() => this.workload().filter((t) => t.availability === 'AVAILABLE').length);
  readonly busyCount = computed(() => this.workload().filter((t) => t.availability === 'BUSY').length);
  readonly workloadSorted = computed(() => this.workload().slice().sort((a, b) => b.activeTicketCount - a.activeTicketCount));

  constructor() {
    this.userService.listTechnicianWorkload().subscribe((data) => this.workload.set(data));
  }
}
