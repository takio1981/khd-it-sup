import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, NgClass } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { debounceTime, distinctUntilChanged, firstValueFrom, Subject } from 'rxjs';
import { RepairTicketService } from '../../../core/services/repair-ticket.service';
import { SocketService } from '../../../core/services/socket.service';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { URGENCY_LABEL_TH, URGENCY_COLOR } from '../../../core/constants/status.const';
import { TicketFormComponent } from '../ticket-form/ticket-form.component';
import { downloadBlob } from '../../../core/utils/download.util';
import { exportTableToPdf } from '../../../core/utils/pdf-table-export.util';
import type { IRepairTicketListItem } from '../../../core/models/repair-ticket.model';

const EXPORT_PDF_MAX_ROWS = 500;

@Component({
  selector: 'khd-ticket-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FormsModule,
    DatePipe,
    NgClass,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatMenuModule,
    StatusBadgeComponent,
    IconComponent,
    HasPermissionDirective,
  ],
  templateUrl: './ticket-list.component.html',
})
export class TicketListComponent {
  private readonly repairTicketService = inject(RepairTicketService);
  private readonly socketService = inject(SocketService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly exporting = signal(false);

  readonly urgencyLabels = URGENCY_LABEL_TH;
  readonly urgencyColor = URGENCY_COLOR;

  readonly displayedColumns = ['ticketNumber', 'description', 'urgency', 'status', 'reportedBy', 'technician', 'createdAt'];
  readonly tickets = signal<IRepairTicketListItem[]>([]);
  readonly total = signal(0);
  readonly pageSize = signal(20);
  readonly pageIndex = signal(0);
  readonly loading = signal(true);

  keyword = '';
  status = '';
  urgency = '';
  private readonly keyword$ = new Subject<string>();

  constructor() {
    this.keyword$.pipe(debounceTime(350), distinctUntilChanged()).subscribe(() => {
      this.pageIndex.set(0);
      this.fetch();
    });
    this.fetch();

    // งานแจ้งซ่อมใหม่เข้ามาขณะเปิดหน้าตารางค้างไว้ — รีเฟรชหน้าปัจจุบันเงียบๆ ให้เห็นสัญลักษณ์กระพริบทันทีโดยไม่ต้องกดรีเฟรชเอง
    this.socketService.ticketCreated$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.fetch());

    // มีแอดมิน/ช่างอีกคนเปิดดูรายละเอียด ticket ที่แสดงอยู่ในตารางนี้เป็นคนแรก — แก้ค่าตรงแถวนั้นให้หยุดกระพริบทันที ไม่ต้อง fetch ใหม่ทั้งตาราง
    this.socketService.ticketViewed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (!event.viewedByUserId || !event.viewedByName) return;
      this.tickets.update((list) =>
        list.map((t) =>
          t.id === event.ticketId && !t.firstViewedBy
            ? { ...t, firstViewedBy: { id: event.viewedByUserId!, fullName: event.viewedByName! }, firstViewedAt: new Date().toISOString() }
            : t,
        ),
      );
    });
  }

  onKeywordChange(): void {
    this.keyword$.next(this.keyword);
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
    this.repairTicketService
      .list({
        page: this.pageIndex() + 1,
        limit: this.pageSize(),
        keyword: this.keyword || undefined,
        status: this.status || undefined,
        urgency: this.urgency || undefined,
      })
      .subscribe((res) => {
        this.tickets.set(res.items);
        this.total.set(res.meta.total);
        this.loading.set(false);
      });
  }

  openCreateForm(): void {
    const ref = this.dialog.open(TicketFormComponent, { width: '520px' });
    ref.afterClosed().subscribe((ticket) => {
      if (ticket) {
        this.fetch();
        void this.router.navigate(['/repair-tickets', ticket.id]);
      }
    });
  }

  viewTicket(ticket: IRepairTicketListItem): void {
    void this.router.navigate(['/repair-tickets', ticket.id]);
  }

  private currentFilter() {
    return { keyword: this.keyword || undefined, status: this.status || undefined, urgency: this.urgency || undefined };
  }

  exportExcel(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.repairTicketService.exportFile(this.currentFilter(), 'xlsx').subscribe({
      next: (blob) => {
        downloadBlob(blob, `repair-tickets-${Date.now()}.xlsx`);
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
    this.repairTicketService.exportFile(this.currentFilter(), 'csv').subscribe({
      next: (blob) => {
        downloadBlob(blob, `repair-tickets-${Date.now()}.csv`);
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
      const res = await firstValueFrom(this.repairTicketService.list({ ...this.currentFilter(), page: 1, limit: EXPORT_PDF_MAX_ROWS }));
      await exportTableToPdf({
        title: 'รายงานงานแจ้งซ่อม',
        subtitle: `ทั้งหมด ${res.items.length} รายการ${res.meta.total > res.items.length ? ` (จากทั้งหมด ${res.meta.total} รายการ)` : ''}`,
        columns: ['เลขที่', 'สถานะ', 'ความเร่งด่วน', 'รายละเอียด', 'ผู้แจ้ง', 'ช่างผู้รับผิดชอบ', 'วันที่แจ้ง'],
        rows: res.items.map((t) => [
          t.ticketNumber,
          t.workflowInstance?.currentStep?.stepNameTh ?? t.status,
          this.urgencyLabels[t.urgency] ?? t.urgency,
          t.description,
          t.reportedBy?.fullName ?? '',
          t.assignedTechnician?.fullName ?? 'ยังไม่มอบหมาย',
          new Date(t.createdAt).toLocaleDateString('th-TH'),
        ]),
        filename: `repair-tickets-${Date.now()}.pdf`,
      });
    } catch {
      this.snackBar.open('Export PDF ไม่สำเร็จ', 'ปิด', { duration: 3000 });
    } finally {
      this.exporting.set(false);
    }
  }
}
