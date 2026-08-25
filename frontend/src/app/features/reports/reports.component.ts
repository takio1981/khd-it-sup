import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideNativeDateAdapter } from '@angular/material/core';
import { RepairTicketService, type ITicketListFilter } from '../../core/services/repair-ticket.service';
import { AssetLoanService, type IListAssetLoansParams } from '../../core/services/asset-loan.service';
import { DepartmentService } from '../../core/services/department.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { BarChartComponent, type IBarChartDatum } from '../../shared/components/bar-chart/bar-chart.component';
import { TechnicianWorkloadReportComponent } from '../../shared/components/technician-workload-report/technician-workload-report.component';
import { URGENCY_LABEL_TH, URGENCY_COLOR } from '../../core/constants/status.const';
import { downloadBlob } from '../../core/utils/download.util';
import type { IRepairTicketListItem } from '../../core/models/repair-ticket.model';
import type { IAssetLoan, AssetLoanStatus } from '../../core/models/asset-loan.model';
import type { IDepartment } from '../../core/models/user.model';

const LOAN_STATUS_LABEL_TH: Record<string, string> = {
  BORROWED: 'กำลังยืม',
  OVERDUE: 'เกินกำหนด',
  RETURNED: 'คืนแล้ว',
};

@Component({
  selector: 'khd-reports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    DatePipe,
    MatTabsModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatDatepickerModule,
    MatButtonModule,
    MatMenuModule,
    IconComponent,
    StatusBadgeComponent,
    BarChartComponent,
    TechnicianWorkloadReportComponent,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './reports.component.html',
})
export class ReportsComponent {
  private readonly repairTicketService = inject(RepairTicketService);
  private readonly assetLoanService = inject(AssetLoanService);
  private readonly departmentService = inject(DepartmentService);
  private readonly snackBar = inject(MatSnackBar);

  readonly urgencyLabels = URGENCY_LABEL_TH;
  readonly urgencyColor = URGENCY_COLOR;
  readonly loanStatusLabel = LOAN_STATUS_LABEL_TH;

  readonly departments = signal<IDepartment[]>([]);

  // --- ประวัติแจ้งซ่อม ---
  readonly ticketColumns = ['ticketNumber', 'description', 'urgency', 'status', 'department', 'technician', 'createdAt'];
  readonly tickets = signal<IRepairTicketListItem[]>([]);
  readonly ticketTotal = signal(0);
  readonly ticketPageSize = signal(20);
  readonly ticketPageIndex = signal(0);
  readonly ticketLoading = signal(true);
  readonly ticketExporting = signal(false);

  ticketDateFrom: Date | null = null;
  ticketDateTo: Date | null = null;
  ticketDepartmentId = '';
  ticketUrgency = '';

  // --- ประวัติการยืม-คืน ---
  readonly loanColumns = ['asset', 'borrower', 'borrowDate', 'expectedReturnDate', 'status'];
  readonly loans = signal<IAssetLoan[]>([]);
  readonly loanTotal = signal(0);
  readonly loanPageSize = signal(20);
  readonly loanPageIndex = signal(0);
  readonly loanLoading = signal(true);
  readonly loanExporting = signal(false);
  readonly loanDepartmentBreakdown = signal<{ departmentName: string; loanCount: number }[]>([]);

  loanDateFrom: Date | null = null;
  loanDateTo: Date | null = null;
  loanStatus = '';

  readonly loanDepartmentChartData = computed<IBarChartDatum[]>(() =>
    this.loanDepartmentBreakdown().map((d) => ({ label: d.departmentName, value: d.loanCount })),
  );

  constructor() {
    this.departmentService.list().subscribe((data) => this.departments.set(data));
    this.fetchTickets();
    this.fetchLoans();
    this.fetchLoanDepartmentBreakdown();
  }

  // --- ประวัติแจ้งซ่อม ---

  onTicketFilterChange(): void {
    this.ticketPageIndex.set(0);
    this.fetchTickets();
  }

  onTicketPage(event: PageEvent): void {
    this.ticketPageIndex.set(event.pageIndex);
    this.ticketPageSize.set(event.pageSize);
    this.fetchTickets();
  }

  private currentTicketFilter(): Omit<ITicketListFilter, 'page' | 'limit'> {
    return {
      departmentId: this.ticketDepartmentId || undefined,
      urgency: this.ticketUrgency || undefined,
      dateFrom: this.ticketDateFrom ? this.ticketDateFrom.toISOString() : undefined,
      dateTo: this.ticketDateTo ? this.ticketDateTo.toISOString() : undefined,
    };
  }

  fetchTickets(): void {
    this.ticketLoading.set(true);
    this.repairTicketService
      .list({ page: this.ticketPageIndex() + 1, limit: this.ticketPageSize(), ...this.currentTicketFilter() })
      .subscribe((res) => {
        this.tickets.set(res.items);
        this.ticketTotal.set(res.meta.total);
        this.ticketLoading.set(false);
      });
  }

  exportTicketsExcel(): void {
    if (this.ticketExporting()) return;
    this.ticketExporting.set(true);
    this.repairTicketService.exportFile(this.currentTicketFilter(), 'xlsx').subscribe({
      next: (blob) => {
        downloadBlob(blob, `repair-tickets-report-${Date.now()}.xlsx`);
        this.ticketExporting.set(false);
      },
      error: () => {
        this.ticketExporting.set(false);
        this.snackBar.open('Export Excel ไม่สำเร็จ', 'ปิด', { duration: 3000 });
      },
    });
  }

  exportTicketsCsv(): void {
    if (this.ticketExporting()) return;
    this.ticketExporting.set(true);
    this.repairTicketService.exportFile(this.currentTicketFilter(), 'csv').subscribe({
      next: (blob) => {
        downloadBlob(blob, `repair-tickets-report-${Date.now()}.csv`);
        this.ticketExporting.set(false);
      },
      error: () => {
        this.ticketExporting.set(false);
        this.snackBar.open('Export CSV ไม่สำเร็จ', 'ปิด', { duration: 3000 });
      },
    });
  }

  // --- ประวัติการยืม-คืน ---

  onLoanFilterChange(): void {
    this.loanPageIndex.set(0);
    this.fetchLoans();
    this.fetchLoanDepartmentBreakdown();
  }

  onLoanPage(event: PageEvent): void {
    this.loanPageIndex.set(event.pageIndex);
    this.loanPageSize.set(event.pageSize);
    this.fetchLoans();
  }

  private currentLoanFilter(): Omit<IListAssetLoansParams, 'page' | 'limit'> {
    return {
      status: (this.loanStatus || undefined) as AssetLoanStatus | undefined,
      dateFrom: this.loanDateFrom ? this.loanDateFrom.toISOString() : undefined,
      dateTo: this.loanDateTo ? this.loanDateTo.toISOString() : undefined,
    };
  }

  fetchLoans(): void {
    this.loanLoading.set(true);
    this.assetLoanService
      .list({ page: this.loanPageIndex() + 1, limit: this.loanPageSize(), ...this.currentLoanFilter() })
      .subscribe((res) => {
        this.loans.set(res.items);
        this.loanTotal.set(res.meta.total);
        this.loanLoading.set(false);
      });
  }

  fetchLoanDepartmentBreakdown(): void {
    this.assetLoanService.getDepartmentBreakdown(this.currentLoanFilter()).subscribe((data) => this.loanDepartmentBreakdown.set(data));
  }

  exportLoansExcel(): void {
    if (this.loanExporting()) return;
    this.loanExporting.set(true);
    this.assetLoanService.exportFile(this.currentLoanFilter(), 'xlsx').subscribe({
      next: (blob) => {
        downloadBlob(blob, `asset-loans-report-${Date.now()}.xlsx`);
        this.loanExporting.set(false);
      },
      error: () => {
        this.loanExporting.set(false);
        this.snackBar.open('Export Excel ไม่สำเร็จ', 'ปิด', { duration: 3000 });
      },
    });
  }

  exportLoansCsv(): void {
    if (this.loanExporting()) return;
    this.loanExporting.set(true);
    this.assetLoanService.exportFile(this.currentLoanFilter(), 'csv').subscribe({
      next: (blob) => {
        downloadBlob(blob, `asset-loans-report-${Date.now()}.csv`);
        this.loanExporting.set(false);
      },
      error: () => {
        this.loanExporting.set(false);
        this.snackBar.open('Export CSV ไม่สำเร็จ', 'ปิด', { duration: 3000 });
      },
    });
  }
}
