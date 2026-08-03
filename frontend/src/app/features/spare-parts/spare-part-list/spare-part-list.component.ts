import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { debounceTime, distinctUntilChanged, firstValueFrom, Subject } from 'rxjs';
import { SparePartService } from '../../../core/services/spare-part.service';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { downloadBlob } from '../../../core/utils/download.util';
import { exportTableToPdf } from '../../../core/utils/pdf-table-export.util';
import type { ISparePart, SparePartTxnType } from '../../../core/models/spare-part.model';

const EXPORT_PDF_MAX_ROWS = 500;

const STOCK_ADJUST_TYPES: SparePartTxnType[] = ['RECEIVE', 'PURCHASE', 'ADJUST', 'RETURN'];
const TXN_TYPE_LABEL_TH: Record<string, string> = {
  RESERVE: 'จอง',
  ISSUE: 'เบิกใช้',
  RETURN: 'คืน',
  ADJUST: 'ปรับยอด',
  PURCHASE: 'จัดซื้อเข้า',
  RECEIVE: 'รับเข้า',
};

interface IStockDialogData {
  sparePart: ISparePart;
}

/** Dialog ปรับสต็อกอะไหล่ (รับเข้า/จัดซื้อ/คืน/ปรับยอด) — แยกจาก "เบิกอะไหล่" ที่ผูกกับใบแจ้งซ่อมโดยเฉพาะ (อยู่ที่ ticket-detail) */
@Component({
  selector: 'khd-stock-adjust-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>ปรับสต็อก: {{ data.sparePart.code }} - {{ data.sparePart.name }}</h2>
    <form [formGroup]="form">
      <mat-dialog-content class="!flex !flex-col !gap-1">
        <p class="text-xs text-neutral-500 !mt-0 !mb-2">คงเหลือปัจจุบัน: {{ data.sparePart.quantityOnHand }} {{ data.sparePart.unit }}</p>
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>ประเภทรายการ</mat-label>
          <mat-select formControlName="type">
            @for (t of types; track t) {
              <mat-option [value]="t">{{ typeLabels[t] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>{{ form.value.type === 'ADJUST' ? 'จำนวนที่ปรับ (ติดลบได้)' : 'จำนวน' }}</mat-label>
          <input matInput type="number" formControlName="quantity" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>หมายเหตุ (ถ้ามี)</mat-label>
          <input matInput formControlName="note" />
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>ยกเลิก</button>
        <button mat-flat-button color="primary" [disabled]="form.invalid" [mat-dialog-close]="form.getRawValue()">บันทึก</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class StockAdjustDialogComponent {
  private readonly fb = inject(FormBuilder);
  readonly data = inject<IStockDialogData>(MAT_DIALOG_DATA);
  readonly types = STOCK_ADJUST_TYPES;
  readonly typeLabels = TXN_TYPE_LABEL_TH;

  readonly form = this.fb.nonNullable.group({
    type: ['RECEIVE' as SparePartTxnType, Validators.required],
    quantity: [1, [Validators.required]],
    note: [''],
  });
}

@Component({
  selector: 'khd-spare-part-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatMenuModule,
    IconComponent,
    HasPermissionDirective,
  ],
  templateUrl: './spare-part-list.component.html',
})
export class SparePartListComponent {
  private readonly fb = inject(FormBuilder);
  private readonly sparePartService = inject(SparePartService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly displayedColumns = ['code', 'name', 'quantityOnHand', 'reorderLevel', 'unit', 'actions'];
  readonly parts = signal<ISparePart[]>([]);
  readonly total = signal(0);
  readonly pageSize = signal(20);
  readonly pageIndex = signal(0);
  readonly loading = signal(true);
  readonly exporting = signal(false);
  readonly showForm = signal(false);
  readonly saving = signal(false);
  readonly editingId = signal<string | null>(null);

  keyword = '';
  lowStockOnly = false;
  private readonly keyword$ = new Subject<string>();

  readonly form = this.fb.nonNullable.group({
    code: ['', Validators.required],
    name: ['', Validators.required],
    unit: ['ชิ้น'],
    reorderLevel: [0],
    unitCost: [null as number | null],
  });

  constructor() {
    this.keyword$.pipe(debounceTime(350), distinctUntilChanged()).subscribe(() => {
      this.pageIndex.set(0);
      this.fetch();
    });
    this.fetch();
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
    this.sparePartService
      .list({
        page: this.pageIndex() + 1,
        limit: this.pageSize(),
        keyword: this.keyword || undefined,
        lowStockOnly: this.lowStockOnly || undefined,
      })
      .subscribe((res) => {
        this.parts.set(res.items);
        this.total.set(res.meta.total);
        this.loading.set(false);
      });
  }

  isLowStock(part: ISparePart): boolean {
    return part.quantityOnHand <= part.reorderLevel;
  }

  openCreateForm(): void {
    this.editingId.set(null);
    this.form.reset({ code: '', name: '', unit: 'ชิ้น', reorderLevel: 0, unitCost: null });
    this.form.get('code')?.enable();
    this.showForm.set(true);
  }

  openEditForm(part: ISparePart): void {
    this.editingId.set(part.id);
    this.form.reset({
      code: part.code,
      name: part.name,
      unit: part.unit,
      reorderLevel: part.reorderLevel,
      unitCost: part.unitCost ? Number(part.unitCost) : null,
    });
    this.form.get('code')?.disable();
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
  }

  submit(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    const editing = this.editingId();
    const { name, unit, reorderLevel, unitCost } = this.form.getRawValue();
    const request = editing
      ? this.sparePartService.update(editing, { name, unit, reorderLevel, unitCost: unitCost ?? undefined })
      : this.sparePartService.create({ code: this.form.getRawValue().code, name, unit, reorderLevel, unitCost: unitCost ?? undefined });

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.editingId.set(null);
        this.fetch();
      },
      error: () => this.saving.set(false),
    });
  }

  private currentFilter() {
    return { keyword: this.keyword || undefined, lowStockOnly: this.lowStockOnly || undefined };
  }

  exportExcel(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.sparePartService.exportFile(this.currentFilter(), 'xlsx').subscribe({
      next: (blob) => {
        downloadBlob(blob, `spare-parts-${Date.now()}.xlsx`);
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
    this.sparePartService.exportFile(this.currentFilter(), 'csv').subscribe({
      next: (blob) => {
        downloadBlob(blob, `spare-parts-${Date.now()}.csv`);
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
      const res = await firstValueFrom(this.sparePartService.list({ ...this.currentFilter(), page: 1, limit: EXPORT_PDF_MAX_ROWS }));
      await exportTableToPdf({
        title: 'รายงานคลังอะไหล่',
        subtitle: `ทั้งหมด ${res.items.length} รายการ${res.meta.total > res.items.length ? ` (จากทั้งหมด ${res.meta.total} รายการ)` : ''}`,
        columns: ['รหัส', 'ชื่ออะไหล่', 'คงเหลือ', 'จุดสั่งซื้อ', 'หน่วย'],
        rows: res.items.map((p) => [p.code, p.name, String(p.quantityOnHand), String(p.reorderLevel), p.unit]),
        filename: `spare-parts-${Date.now()}.pdf`,
      });
    } catch {
      this.snackBar.open('Export PDF ไม่สำเร็จ', 'ปิด', { duration: 3000 });
    } finally {
      this.exporting.set(false);
    }
  }

  openStockDialog(part: ISparePart): void {
    const ref = this.dialog.open(StockAdjustDialogComponent, { width: '420px', data: { sparePart: part } });
    ref.afterClosed().subscribe((result: { type: SparePartTxnType; quantity: number; note: string } | undefined) => {
      if (!result) return;
      this.sparePartService.recordTransaction(part.id, { type: result.type, quantity: result.quantity, note: result.note || undefined }).subscribe({
        next: () => {
          this.snackBar.open('ปรับสต็อกแล้ว', 'ปิด', { duration: 2000 });
          this.fetch();
        },
        error: (err) => {
          const message = err?.error?.error?.message ?? 'ปรับสต็อกไม่สำเร็จ';
          this.snackBar.open(message, 'ปิด', { duration: 3000 });
        },
      });
    });
  }
}
