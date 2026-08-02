import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { AuditLogService } from '../../../core/services/audit-log.service';
import type { AuditLogAction, IAuditLog } from '../../../core/models/audit-log.model';

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
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './audit-log-list.component.html',
})
export class AuditLogListComponent {
  private readonly auditLogService = inject(AuditLogService);

  readonly actionLabel = ACTION_LABEL_TH;
  readonly actionColor = ACTION_COLOR;
  readonly actions = Object.keys(ACTION_LABEL_TH) as AuditLogAction[];

  readonly displayedColumns = ['createdAt', 'user', 'action', 'module', 'description', 'ipAddress'];
  readonly logs = signal<IAuditLog[]>([]);
  readonly total = signal(0);
  readonly pageSize = signal(20);
  readonly pageIndex = signal(0);
  readonly loading = signal(true);

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
}
