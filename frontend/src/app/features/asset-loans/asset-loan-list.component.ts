import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, type Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { DatePipe } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { AssetLoanService } from '../../core/services/asset-loan.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { downloadBlob } from '../../core/utils/download.util';
import { exportTableToPdf } from '../../core/utils/pdf-table-export.util';

import { AssetLoanFormComponent } from './asset-loan-form/asset-loan-form.component';
import { AssetLoanReturnFormComponent } from './asset-loan-return-form/asset-loan-return-form.component';
import type { IAssetLoan, AssetLoanStatus } from '../../core/models/asset-loan.model';

const EXPORT_PDF_MAX_ROWS = 500;

const STATUS_LABEL_TH: Record<string, string> = {
  BORROWED: 'กำลังยืม',
  OVERDUE: 'เกินกำหนด',
  RETURNED: 'คืนแล้ว',
};

const STATUS_COLOR: Record<string, string> = {
  BORROWED: '#3B82F6',
  OVERDUE: '#EF4444',
  RETURNED: '#22C55E',
};

@Component({
  selector: 'khd-asset-loan-list',
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
    MatButtonModule,
    MatMenuModule,
    IconComponent,
    HasPermissionDirective,
  ],
  templateUrl: './asset-loan-list.component.html',
})
export class AssetLoanListComponent {
  private readonly assetLoanService = inject(AssetLoanService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly route = inject(ActivatedRoute);

  readonly statusLabel = STATUS_LABEL_TH;
  readonly statusColor = STATUS_COLOR;

  readonly displayedColumns = ['asset', 'borrower', 'borrowDate', 'expectedReturnDate', 'status', 'actions'];
  readonly loans = signal<IAssetLoan[]>([]);
  readonly total = signal(0);
  readonly pageSize = signal(20);
  readonly pageIndex = signal(0);
  readonly loading = signal(true);
  readonly exporting = signal(false);

  status = '';
  keyword = '';

  constructor() {
    this.keyword = this.route.snapshot.queryParamMap.get('keyword') ?? '';
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
    this.assetLoanService
      .list({
        page: this.pageIndex() + 1,
        limit: this.pageSize(),
        status: (this.status || undefined) as AssetLoanStatus | undefined,
        keyword: this.keyword || undefined,
      })
      .subscribe((res) => {
        this.loans.set(res.items);
        this.total.set(res.meta.total);
        this.loading.set(false);
      });
  }

  private fetchBorrowedAssetIds(): Observable<Set<string>> {
    return forkJoin([
      this.assetLoanService.list({ page: 1, limit: 500, status: 'BORROWED' }),
      this.assetLoanService.list({ page: 1, limit: 500, status: 'OVERDUE' }),
    ]).pipe(map(([borrowed, overdue]) => new Set([...borrowed.items, ...overdue.items].map((l) => l.assetId))));
  }

  openCreateForm(): void {
    this.fetchBorrowedAssetIds().subscribe((borrowedAssetIds) => {
      const ref = this.dialog.open(AssetLoanFormComponent, { width: '480px', data: { loan: null, borrowedAssetIds } });
      ref.afterClosed().subscribe((result) => result && this.fetch());
    });
  }

  openEditForm(loan: IAssetLoan): void {
    this.fetchBorrowedAssetIds().subscribe((borrowedAssetIds) => {
      const ref = this.dialog.open(AssetLoanFormComponent, { width: '480px', data: { loan, borrowedAssetIds } });
      ref.afterClosed().subscribe((result) => result && this.fetch());
    });
  }

  returnLoan(loan: IAssetLoan): void {
    const ref = this.dialog.open(AssetLoanReturnFormComponent, { width: '420px', data: { loan } });
    ref.afterClosed().subscribe((result) => result && this.fetch());
  }

  private currentFilter() {
    return { status: (this.status || undefined) as AssetLoanStatus | undefined, keyword: this.keyword || undefined };
  }

  exportExcel(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.assetLoanService.exportFile(this.currentFilter(), 'xlsx').subscribe({
      next: (blob) => {
        downloadBlob(blob, `asset-loans-${Date.now()}.xlsx`);
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
    this.assetLoanService.exportFile(this.currentFilter(), 'csv').subscribe({
      next: (blob) => {
        downloadBlob(blob, `asset-loans-${Date.now()}.csv`);
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
      const res = await firstValueFrom(this.assetLoanService.list({ ...this.currentFilter(), page: 1, limit: EXPORT_PDF_MAX_ROWS }));
      await exportTableToPdf({
        title: 'รายงานยืมครุภัณฑ์-อุปกรณ์',
        subtitle: `ทั้งหมด ${res.items.length} รายการ${res.meta.total > res.items.length ? ` (จากทั้งหมด ${res.meta.total} รายการ)` : ''}`,
        columns: ['ครุภัณฑ์', 'ผู้ยืม', 'วันที่ยืม', 'กำหนดคืน', 'สถานะ'],
        rows: res.items.map((l) => [
          `${l.asset.assetNumber}${l.asset.brand ? ' - ' + l.asset.brand : ''}`,
          l.borrower.fullName,
          new Date(l.borrowDate).toLocaleDateString('th-TH'),
          l.expectedReturnDate ? new Date(l.expectedReturnDate).toLocaleDateString('th-TH') : '-',
          this.statusLabel[l.status] ?? l.status,
        ]),
        filename: `asset-loans-${Date.now()}.pdf`,
      });
    } catch {
      this.snackBar.open('Export PDF ไม่สำเร็จ', 'ปิด', { duration: 3000 });
    } finally {
      this.exporting.set(false);
    }
  }

  deleteLoan(loan: IAssetLoan): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '380px',
      data: {
        title: 'ลบรายการยืม',
        message: `ยืนยันการลบรายการยืมครุภัณฑ์ ${loan.asset.assetNumber} ของ ${loan.borrower.fullName} ใช่หรือไม่?`,
        danger: true,
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) this.assetLoanService.remove(loan.id).subscribe(() => this.fetch());
    });
  }
}
