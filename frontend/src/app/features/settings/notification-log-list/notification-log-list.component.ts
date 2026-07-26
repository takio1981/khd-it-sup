import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { NotificationService } from '../../../core/services/notification.service';
import type { INotificationLog, NotificationChannel, NotificationStatus } from '../../../core/models/notification.model';

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
  imports: [FormsModule, DatePipe, MatTableModule, MatPaginatorModule, MatFormFieldModule, MatSelectModule],
  templateUrl: './notification-log-list.component.html',
})
export class NotificationLogListComponent {
  private readonly notificationService = inject(NotificationService);

  readonly channelLabel = CHANNEL_LABEL_TH;
  readonly statusLabel = STATUS_LABEL_TH;
  readonly statusColor = STATUS_COLOR;

  readonly displayedColumns = ['channel', 'recipient', 'subject', 'status', 'createdAt'];
  readonly logs = signal<INotificationLog[]>([]);
  readonly total = signal(0);
  readonly pageSize = signal(20);
  readonly pageIndex = signal(0);
  readonly loading = signal(true);

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

}
