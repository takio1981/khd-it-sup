import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, MatPaginatorIntl, type PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideNativeDateAdapter } from '@angular/material/core';
import { firstValueFrom } from 'rxjs';
import { AuditLogService } from '../../../core/services/audit-log.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { downloadBlob } from '../../../core/utils/download.util';
import { exportTableToPdf } from '../../../core/utils/pdf-table-export.util';
import { formatKhdNumber } from '../../../core/utils/number-format.util';
import { provideKhdPaginatorIntl } from '../../../core/utils/khd-paginator-intl.util';
import type { AuditLogAction, IAuditLog } from '../../../core/models/audit-log.model';

const EXPORT_PDF_MAX_ROWS = 500;

const ACTION_LABEL_TH: Record<string, string> = {
  LOGIN: 'เข้าสู่ระบบ',
  LOGOUT: 'ออกจากระบบ',
  CREATE: 'สร้างใหม่',
  UPDATE: 'แก้ไข',
  DELETE: 'ลบ',
  PRINT: 'พิมพ์เอกสาร',
  EXPORT: 'ส่งออกข้อมูล',
  APPROVE: 'อนุมัติ',
  CONFIG_CHANGE: 'เปลี่ยนแปลงการตั้งค่า',
};

const ACTION_COLOR: Record<string, string> = {
  LOGIN: '#22C55E',
  LOGOUT: '#64748B',
  CREATE: '#22C55E',
  UPDATE: '#F59E0B',
  DELETE: '#EF4444',
  PRINT: '#06B6D4',
  EXPORT: '#06B6D4',
  APPROVE: '#8B5CF6',
  CONFIG_CHANGE: '#F59E0B',
};

@Component({
  selector: 'khd-audit-log-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    DatePipe,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatDatepickerModule,
    MatButtonModule,
    MatMenuModule,
    IconComponent,
  ],
  providers: [provideNativeDateAdapter(), { provide: MatPaginatorIntl, useFactory: provideKhdPaginatorIntl }],
  templateUrl: './audit-log-list.component.html',
})
export class AuditLogListComponent {
  private readonly auditLogService = inject(AuditLogService);
  private readonly snackBar = inject(MatSnackBar);

  readonly actionLabel = ACTION_LABEL_TH;
  readonly actionColor = ACTION_COLOR;
  readonly actions = Object.keys(ACTION_LABEL_TH) as AuditLogAction[];

  readonly displayedColumns = ['createdAt', 'user', 'action', 'module', 'description', 'ipAddress'];
  readonly logs = signal<IAuditLog[]>([]);
  readonly total = signal(0);
  readonly pageSize = signal(20);
  readonly pageIndex = signal(0);
  readonly loading = signal(true);
  readonly exporting = signal(false);

  module = '';
  action = '';
  dateFrom: Date | null = null;
  dateTo: Date | null = null;

  constructor() {
    this.fetch();
  }

  onFilterChange(): void {
    this.pageIndex.set(0);
    this.fetch();
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.fetch();
  }

  fetch(): void {
    this.loading.set(true);
    this.auditLogService
      .list({
        page: this.pageIndex() + 1,
        limit: this.pageSize(),
        module: this.module || undefined,
        action: (this.action || undefined) as AuditLogAction | undefined,
        dateFrom: this.dateFrom ? this.dateFrom.toISOString() : undefined,
        dateTo: this.dateTo ? this.dateTo.toISOString() : undefined,
      })
      .subscribe((res) => {
        this.logs.set(res.items);
        this.total.set(res.meta.total);
        this.loading.set(false);
      });
  }

  private currentFilter() {
    return {
      module: this.module || undefined,
      action: (this.action || undefined) as AuditLogAction | undefined,
      dateFrom: this.dateFrom ? this.dateFrom.toISOString() : undefined,
      dateTo: this.dateTo ? this.dateTo.toISOString() : undefined,
    };
  }

  exportExcel(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.auditLogService.exportFile(this.currentFilter(), 'xlsx').subscribe({
      next: (blob) => {
        downloadBlob(blob, `audit-logs-${Date.now()}.xlsx`);
        this.exporting.set(false);
      },
      error: () => {
        this.exporting.set(false);
        this.snackBar.open('Export Excel ไม่สำเร็จ', 'ปิด', { duration: 3000 });
      },
    });
  }

  exportCsv(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.auditLogService.exportFile(this.currentFilter(), 'csv').subscribe({
      next: (blob) => {
        downloadBlob(blob, `audit-logs-${Date.now()}.csv`);
        this.exporting.set(false);
      },
      error: () => {
        this.exporting.set(false);
        this.snackBar.open('Export CSV ไม่สำเร็จ', 'ปิด', { duration: 3000 });
      },
    });
  }

  async exportPdf(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
      const res = await firstValueFrom(this.auditLogService.list({ ...this.currentFilter(), page: 1, limit: EXPORT_PDF_MAX_ROWS }));
      await exportTableToPdf({
        title: 'รายงานประวัติการใช้งานระบบ',
        subtitle: `ทั้งหมด ${formatKhdNumber(res.items.length)} รายการ${res.meta.total > res.items.length ? ` (จากทั้งหมด ${formatKhdNumber(res.meta.total)} รายการ)` : ''}`,
        columns: ['เวลา', 'ผู้ใช้', 'การกระทำ', 'โมดูล', 'รายละเอียด'],
        rows: res.items.map((l) => [
          new Date(l.createdAt).toLocaleString('th-TH'),
          l.user?.fullName ?? '-',
          this.actionLabel[l.action] ?? l.action,
          l.module,
          l.description ?? '-',
        ]),
        filename: `audit-logs-${Date.now()}.pdf`,
      });
    } catch {
      this.snackBar.open('Export PDF ไม่สำเร็จ', 'ปิด', { duration: 3000 });
    } finally {
      this.exporting.set(false);
    }
  }
}
