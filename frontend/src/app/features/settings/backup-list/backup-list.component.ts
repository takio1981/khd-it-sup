import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, MatPaginatorIntl, type PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { interval, startWith, switchMap, takeWhile } from 'rxjs';
import { BackupService } from '../../../core/services/backup.service';
import { AuthService } from '../../../core/services/auth.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ConfirmDialogComponent, type IConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { BackupTablePickerComponent } from '../backup-table-picker/backup-table-picker.component';
import { BackupRestoreDialogComponent, type IBackupRestoreDialogData } from '../backup-restore-dialog/backup-restore-dialog.component';
import { downloadBlob } from '../../../core/utils/download.util';
import { provideKhdPaginatorIntl } from '../../../core/utils/khd-paginator-intl.util';
import type { BackupAction, BackupScope, IBackupLog, IBackupStatus, IBackupTableGroup } from '../../../core/models/backup.model';

const POLL_INTERVAL_MS = 3000;

const ACTION_LABEL_TH: Record<string, string> = { BACKUP: 'สำรองข้อมูล', RESTORE: 'กู้คืนข้อมูล' };
const ACTION_COLOR: Record<string, string> = { BACKUP: '#22C55E', RESTORE: '#F59E0B' };
const TYPE_LABEL_TH: Record<string, string> = { MANUAL: 'กดเอง', AUTOMATIC: 'อัตโนมัติ', SAFETY: 'นิรภัย (ก่อนกู้คืน)' };
const STATUS_LABEL_TH: Record<string, string> = { SUCCESS: 'สำเร็จ', FAILED: 'ล้มเหลว' };
const STATUS_COLOR: Record<string, string> = { SUCCESS: '#22C55E', FAILED: '#EF4444' };

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

@Component({
  selector: 'khd-backup-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    DatePipe,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatMenuModule,
    MatExpansionModule,
    MatProgressSpinnerModule,
    IconComponent,
    BackupTablePickerComponent,
  ],
  providers: [{ provide: MatPaginatorIntl, useFactory: provideKhdPaginatorIntl }],
  templateUrl: './backup-list.component.html',
})
export class BackupListComponent {
  private readonly backupService = inject(BackupService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly canManage = computed(() => this.authService.hasPermission('backup:manage'));

  readonly actionLabel = ACTION_LABEL_TH;
  readonly actionColor = ACTION_COLOR;
  readonly typeLabel = TYPE_LABEL_TH;
  readonly statusLabel = STATUS_LABEL_TH;
  readonly statusColor = STATUS_COLOR;
  readonly formatBytes = formatBytes;

  readonly displayedColumns = ['startedAt', 'action', 'type', 'scope', 'fileName', 'fileSizeBytes', 'status', 'triggeredByUser', 'actions'];

  readonly logs = signal<IBackupLog[]>([]);
  readonly total = signal(0);
  readonly pageSize = signal(20);
  readonly pageIndex = signal(0);
  readonly loading = signal(true);

  readonly status = signal<IBackupStatus | null>(null);
  readonly running = computed(() => this.status()?.isRunning ?? false);

  readonly tableGroups = signal<IBackupTableGroup[]>([]);
  readonly triggering = signal(false);
  runScope: BackupScope = 'FULL';
  runIncludedTables: string[] = [];

  actionFilter = '';
  typeFilter = '';
  statusFilter = '';

  constructor() {
    this.backupService.getTables().subscribe((groups) => this.tableGroups.set(groups));
    this.backupService.getStatus().subscribe((s) => {
      this.status.set(s);
      if (s.isRunning) this.pollUntilDone();
    });
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
    this.backupService
      .list({
        page: this.pageIndex() + 1,
        limit: this.pageSize(),
        action: (this.actionFilter || undefined) as BackupAction | undefined,
        type: (this.typeFilter || undefined) as never,
        status: (this.statusFilter || undefined) as never,
      })
      .subscribe((res) => {
        this.logs.set(res.items);
        this.total.set(res.meta.total);
        this.loading.set(false);
      });
  }

  runBackupNow(): void {
    if (this.triggering() || this.running()) return;
    if (this.runScope === 'PARTIAL' && this.runIncludedTables.length === 0) {
      this.snackBar.open('กรุณาเลือกอย่างน้อย 1 ตาราง', 'ปิด', { duration: 3000 });
      return;
    }
    this.triggering.set(true);
    this.backupService.runBackup({ scope: this.runScope, includedTables: this.runScope === 'PARTIAL' ? this.runIncludedTables : undefined }).subscribe({
      next: () => {
        this.triggering.set(false);
        this.pollUntilDone();
      },
      error: (err) => {
        this.triggering.set(false);
        this.snackBar.open(err?.error?.error?.message ?? 'เริ่มสำรองข้อมูลไม่สำเร็จ', 'ปิด', { duration: 4000 });
      },
    });
  }

  download(log: IBackupLog): void {
    this.backupService.download(log.id).subscribe({
      next: (blob) => downloadBlob(blob, log.fileName),
      error: () => this.snackBar.open('ดาวน์โหลดไฟล์ไม่สำเร็จ', 'ปิด', { duration: 3000 }),
    });
  }

  deleteBackup(log: IBackupLog): void {
    const data: IConfirmDialogData = {
      title: 'ลบไฟล์สำรองข้อมูล',
      message: `ต้องการลบไฟล์ "${log.fileName}" หรือไม่? การลบนี้ไม่สามารถย้อนกลับได้`,
      confirmLabel: 'ลบ',
      danger: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.backupService.deleteBackup(log.id).subscribe({
          next: () => {
            this.snackBar.open('ลบไฟล์สำรองข้อมูลแล้ว', 'ปิด', { duration: 2000 });
            this.fetch();
          },
          error: () => this.snackBar.open('ลบไฟล์สำรองข้อมูลไม่สำเร็จ', 'ปิด', { duration: 3000 }),
        });
      });
  }

  restore(log: IBackupLog): void {
    const data: IBackupRestoreDialogData = { log };
    this.dialog
      .open(BackupRestoreDialogComponent, { data, width: '480px' })
      .afterClosed()
      .subscribe((started) => {
        if (!started) return;
        this.snackBar.open('เริ่มกู้คืนข้อมูลแล้ว กำลังดำเนินการ...', 'ปิด', { duration: 3000 });
        this.pollUntilDone();
      });
  }

  private pollUntilDone(): void {
    interval(POLL_INTERVAL_MS)
      .pipe(
        startWith(0),
        switchMap(() => this.backupService.getStatus()),
        takeWhile((s) => s.isRunning, true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((s) => {
        const wasRunning = this.status()?.isRunning ?? false;
        this.status.set(s);
        if (wasRunning && !s.isRunning) {
          this.fetch();
        }
      });
  }
}
