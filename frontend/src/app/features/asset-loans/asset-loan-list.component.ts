import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
import { AssetLoanService } from '../../core/services/asset-loan.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

import { AssetLoanFormComponent } from './asset-loan-form/asset-loan-form.component';
import { AssetLoanReturnFormComponent } from './asset-loan-return-form/asset-loan-return-form.component';
import type { IAssetLoan, AssetLoanStatus } from '../../core/models/asset-loan.model';

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

  readonly statusLabel = STATUS_LABEL_TH;
  readonly statusColor = STATUS_COLOR;

  readonly displayedColumns = ['asset', 'borrower', 'borrowDate', 'expectedReturnDate', 'status', 'actions'];
  readonly loans = signal<IAssetLoan[]>([]);
  readonly total = signal(0);
  readonly pageSize = signal(20);
  readonly pageIndex = signal(0);
  readonly loading = signal(true);

  status = '';
  keyword = '';

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
