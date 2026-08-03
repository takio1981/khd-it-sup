import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { debounceTime, distinctUntilChanged, firstValueFrom, Subject } from 'rxjs';
import { VendorService } from '../../../core/services/vendor.service';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { downloadBlob } from '../../../core/utils/download.util';
import { exportTableToPdf } from '../../../core/utils/pdf-table-export.util';
import type { IVendor } from '../../../core/models/vendor.model';

const EXPORT_PDF_MAX_ROWS = 500;

@Component({
  selector: 'khd-vendor-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatMenuModule,
    MatSlideToggleModule,
    IconComponent,
    HasPermissionDirective,
  ],
  templateUrl: './vendor-list.component.html',
})
export class VendorListComponent {
  private readonly fb = inject(FormBuilder);
  private readonly vendorService = inject(VendorService);
  private readonly snackBar = inject(MatSnackBar);

  readonly displayedColumns = ['code', 'name', 'contactPerson', 'phone', 'status', 'actions'];
  readonly vendors = signal<IVendor[]>([]);
  readonly total = signal(0);
  readonly pageSize = signal(20);
  readonly pageIndex = signal(0);
  readonly loading = signal(true);
  readonly showForm = signal(false);
  readonly saving = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly exporting = signal(false);

  keyword = '';
  private readonly keyword$ = new Subject<string>();

  readonly form = this.fb.nonNullable.group({
    code: ['', Validators.required],
    name: ['', Validators.required],
    contactPerson: [''],
    phone: [''],
    email: [''],
    address: [''],
    taxId: [''],
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

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.fetch();
  }

  fetch(): void {
    this.loading.set(true);
    this.vendorService.list({ page: this.pageIndex() + 1, limit: this.pageSize(), keyword: this.keyword || undefined }).subscribe((res) => {
      this.vendors.set(res.items);
      this.total.set(res.meta.total);
      this.loading.set(false);
    });
  }

  openCreateForm(): void {
    this.editingId.set(null);
    this.form.reset({ code: '', name: '', contactPerson: '', phone: '', email: '', address: '', taxId: '' });
    this.form.get('code')?.enable();
    this.showForm.set(true);
  }

  openEditForm(vendor: IVendor): void {
    this.editingId.set(vendor.id);
    this.form.reset({
      code: vendor.code,
      name: vendor.name,
      contactPerson: vendor.contactPerson ?? '',
      phone: vendor.phone ?? '',
      email: vendor.email ?? '',
      address: vendor.address ?? '',
      taxId: vendor.taxId ?? '',
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
    const { name, contactPerson, phone, email, address, taxId } = this.form.getRawValue();
    const request = editing
      ? this.vendorService.update(editing, { name, contactPerson, phone, email, address, taxId })
      : this.vendorService.create({ code: this.form.getRawValue().code, name, contactPerson, phone, email, address, taxId });

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
    return { keyword: this.keyword || undefined };
  }

  exportExcel(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.vendorService.exportFile(this.currentFilter(), 'xlsx').subscribe({
      next: (blob) => {
        downloadBlob(blob, `vendors-${Date.now()}.xlsx`);
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
    this.vendorService.exportFile(this.currentFilter(), 'csv').subscribe({
      next: (blob) => {
        downloadBlob(blob, `vendors-${Date.now()}.csv`);
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
      const res = await firstValueFrom(this.vendorService.list({ ...this.currentFilter(), page: 1, limit: EXPORT_PDF_MAX_ROWS }));
      await exportTableToPdf({
        title: 'รายงานผู้ขาย/ผู้รับซ่อมภายนอก',
        subtitle: `ทั้งหมด ${res.items.length} รายการ${res.meta.total > res.items.length ? ` (จากทั้งหมด ${res.meta.total} รายการ)` : ''}`,
        columns: ['รหัส', 'ชื่อบริษัท/ร้าน', 'ผู้ติดต่อ', 'เบอร์โทร', 'สถานะ'],
        rows: res.items.map((v) => [v.code, v.name, v.contactPerson ?? '-', v.phone ?? '-', v.isActive ? 'ใช้งานอยู่' : 'ปิดใช้งาน']),
        filename: `vendors-${Date.now()}.pdf`,
      });
    } catch {
      this.snackBar.open('Export PDF ไม่สำเร็จ', 'ปิด', { duration: 3000 });
    } finally {
      this.exporting.set(false);
    }
  }

  toggleActive(vendor: IVendor): void {
    this.vendorService.update(vendor.id, { isActive: !vendor.isActive }).subscribe(() => this.fetch());
  }
}
