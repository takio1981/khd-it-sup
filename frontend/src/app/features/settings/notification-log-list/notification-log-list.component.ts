import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { downloadBlob } from '../../../core/utils/download.util';
import { exportTableToPdf } from '../../../core/utils/pdf-table-export.util';
import type { INotificationLog, NotificationChannel, NotificationStatus } from '../../../core/models/notification.model';

const EXPORT_PDF_MAX_ROWS = 500;

const CHANNEL_LABEL_TH: Record<string, string> = {
  EMAIL: 'อีเมล',
  TELEGRAM: 'Telegram',
  LINE: 'LINE',
  PUSH: 'Push',
  SMS: 'SMS',
};

const STATUS_LABEL_TH: Record<string, string> = {
  PENDING: 'รอดำเนินการ',
  SENT: 'ส่งสำเร็จ',
  FAILED: 'ส่งไม่สำเร็จ',
  READ: 'อ่านแล้ว',
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#F59E0B',
  SENT: '#22C55E',
  FAILED: '#EF4444',
  READ: '#06B6D4',
};

@Component({
  selector: 'khd-notification-log-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePipe, MatTableModule, MatPaginatorModule, MatFormFieldModule, MatSelectModule, MatButtonModule, MatMenuModule, IconComponent],
  templateUrl: './notification-log-list.component.html',
})
export class NotificationLogListComponent {
  private readonly notificationService = inject(NotificationService);
  private readonly snackBar = inject(MatSnackBar);

  readonly channelLabel = CHANNEL_LABEL_TH;
  readonly statusLabel = STATUS_LABEL_TH;
  readonly statusColor = STATUS_COLOR;

  readonly displayedColumns = ['channel', 'recipient', 'subject', 'status', 'createdAt'];
  readonly logs = signal<INotificationLog[]>([]);
  readonly total = signal(0);
  readonly pageSize = signal(20);
  readonly pageIndex = signal(0);
  readonly loading = signal(true);
  readonly exporting = signal(false);

  channel = '';
  status = '';

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
    this.notificationService
      .getLogs({
        page: this.pageIndex() + 1,
        limit: this.pageSize(),
        channel: (this.channel || undefined) as NotificationChannel | undefined,
        status: (this.status || undefined) as NotificationStatus | undefined,
      })
      .subscribe((res) => {
        this.logs.set(res.items);
        this.total.set(res.meta.total);
        this.loading.set(false);
      });
  }

  private currentFilter() {
    return {
      channel: (this.channel || undefined) as NotificationChannel | undefined,
      status: (this.status || undefined) as NotificationStatus | undefined,
    };
  }

  exportExcel(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.notificationService.exportLogsFile(this.currentFilter(), 'xlsx').subscribe({
      next: (blob) => {
        downloadBlob(blob, `notification-logs-${Date.now()}.xlsx`);
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
    this.notificationService.exportLogsFile(this.currentFilter(), 'csv').subscribe({
      next: (blob) => {
        downloadBlob(blob, `notification-logs-${Date.now()}.csv`);
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
      const res = await firstValueFrom(this.notificationService.getLogs({ ...this.currentFilter(), page: 1, limit: EXPORT_PDF_MAX_ROWS }));
      await exportTableToPdf({
        title: 'รายงานประวัติการแจ้งเตือน',
        subtitle: `ทั้งหมด ${res.items.length} รายการ${res.meta.total > res.items.length ? ` (จากทั้งหมด ${res.meta.total} รายการ)` : ''}`,
        columns: ['ช่องทาง', 'ผู้รับ', 'หัวข้อ', 'สถานะ', 'เวลา'],
        rows: res.items.map((n) => [
          this.channelLabel[n.channel] ?? n.channel,
          n.recipient,
          n.subject ?? '-',
          this.statusLabel[n.status] ?? n.status,
          new Date(n.createdAt).toLocaleString('th-TH'),
        ]),
        filename: `notification-logs-${Date.now()}.pdf`,
      });
    } catch {
      this.snackBar.open('Export PDF ไม่สำเร็จ', 'ปิด', { duration: 3000 });
    } finally {
      this.exporting.set(false);
    }
  }
}
