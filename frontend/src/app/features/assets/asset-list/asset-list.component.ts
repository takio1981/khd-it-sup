import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconButton } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, firstValueFrom, Subject } from 'rxjs';
import { AssetService } from '../../../core/services/asset.service';
import { QrCodeService } from '../../../core/services/qrcode.service';
import { AuthService } from '../../../core/services/auth.service';
import { DepartmentService } from '../../../core/services/department.service';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { QrPrintPreviewComponent } from '../../../shared/components/qr-print-preview/qr-print-preview.component';
import type { IQrLabelData } from '../../../shared/components/qr-print-preview/qr-print-preview.model';
import { AssetFormComponent } from '../asset-form/asset-form.component';
import { getStatusLabel, getAcquisitionTypeLabel, ACQUISITION_TYPE_LABEL_TH } from '../../../core/constants/status.const';
import { downloadBlob } from '../../../core/utils/download.util';
import { exportTableToPdf } from '../../../core/utils/pdf-table-export.util';
import type { AssetStatus, IAsset, IAssetCategory } from '../../../core/models/asset.model';
import type { IDepartment } from '../../../core/models/user.model';

const ASSET_STATUS_OPTIONS: AssetStatus[] = [
  'ACTIVE',
  'IN_REPAIR',
  'WAITING_PARTS',
  'MAINTENANCE',
  'RESERVED',
  'INACTIVE',
  'DISPOSED',
  'LOST',
];

const EXPORT_PDF_MAX_ROWS = 500;

@Component({
  selector: 'khd-asset-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FormsModule,
    DatePipe,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconButton,
    MatMenuModule,
    MatCheckboxModule,
    IconComponent,
    StatusBadgeComponent,
    HasPermissionDirective,
  ],
  templateUrl: './asset-list.component.html',
})
export class AssetListComponent {
  private readonly assetService = inject(AssetService);
  private readonly qrCodeService = inject(QrCodeService);
  private readonly departmentService = inject(DepartmentService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  readonly authService = inject(AuthService);

  readonly displayedColumns = [
    'select',
    'assetNumber',
    'category',
    'equipClassificationName',
    'brandModel',
    'department',
    'owner',
    'acquisitionType',
    'status',
    'expand',
    'actions',
  ];
  /** แถวรายละเอียดที่ขยายลงมา (multiTemplateDataRows) — ใช้ colspan คลุมทั้งแถว จึงไม่ต้องมีชื่อคอลัมน์ตรงกับ displayedColumns */
  readonly detailColumns = ['expandedDetail'];
  readonly expandedId = signal<string | null>(null);
  readonly assets = signal<IAsset[]>([]);
  readonly categories = signal<IAssetCategory[]>([]);
  readonly departments = signal<IDepartment[]>([]);
  readonly budgetYears = signal<string[]>([]);
  readonly total = signal(0);
  readonly pageSize = signal(20);
  readonly pageIndex = signal(0);
  readonly loading = signal(true);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly printing = signal(false);
  readonly exporting = signal(false);

  readonly statusOptions = ASSET_STATUS_OPTIONS.map((code) => ({ code, label: getStatusLabel(code) }));
  readonly acquisitionTypeOptions = Object.keys(ACQUISITION_TYPE_LABEL_TH).map((code) => ({
    code,
    label: getAcquisitionTypeLabel(code),
  }));

  keyword = '';
  categoryId = '';
  departmentId = '';
  status = '';
  acquisitionType = '';
  budgetYear = '';
  externalSource = '';
  private readonly keyword$ = new Subject<string>();

  constructor() {
    this.assetService.getCategories().subscribe((cats) => this.categories.set(cats));
    this.departmentService.list().subscribe((depts) => this.departments.set(depts));
    this.assetService.getBudgetYears().subscribe((years) => this.budgetYears.set(years));

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
    this.assetService
      .list({
        page: this.pageIndex() + 1,
        limit: this.pageSize(),
        ...this.currentFilter(),
      })
      .subscribe((res) => {
        this.assets.set(res.items);
        this.total.set(res.meta.total);
        this.loading.set(false);
        this.selectedIds.set(new Set());
      });
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelection(id: string): void {
    const next = new Set(this.selectedIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedIds.set(next);
  }

  get allSelectedOnPage(): boolean {
    const items = this.assets();
    return items.length > 0 && items.every((a) => this.selectedIds().has(a.id));
  }

  acquisitionTypeLabel(code: string): string {
    return getAcquisitionTypeLabel(code);
  }

  /** คลิกที่แถว (หรือปุ่ม dropdown) เพื่อขยาย/ยุบแถวรายละเอียดในหน้าเดิม — ไม่เปลี่ยนหน้า ต่างจาก viewAsset ที่ไปหน้ารายละเอียดเต็ม */
  toggleExpand(asset: IAsset): void {
    this.expandedId.set(this.expandedId() === asset.id ? null : asset.id);
  }

  isExpanded(asset: IAsset): boolean {
    return this.expandedId() === asset.id;
  }

  locationLabel(asset: IAsset): string {
    return [asset.building?.name, asset.floor?.name, asset.room?.name].filter(Boolean).join(' / ');
  }

  toggleSelectAll(): void {
    const items = this.assets();
    if (this.allSelectedOnPage) {
      this.selectedIds.set(new Set());
    } else {
      this.selectedIds.set(new Set(items.map((a) => a.id)));
    }
  }

  openCreateForm(): void {
    const ref = this.dialog.open(AssetFormComponent, { width: '520px', data: { asset: null, categories: this.categories() } });
    ref.afterClosed().subscribe((result) => result && this.fetch());
  }

  openEditForm(asset: IAsset): void {
    const ref = this.dialog.open(AssetFormComponent, { width: '520px', data: { asset, categories: this.categories() } });
    ref.afterClosed().subscribe((result) => result && this.fetch());
  }

  viewAsset(asset: IAsset): void {
    void this.router.navigate(['/assets', asset.id]);
  }

  /** สร้าง QR ใหม่ (regenerate) — เตือนก่อนเสมอถ้ามี QR อยู่แล้ว เพราะสติกเกอร์เดิมจะใช้ไม่ได้ทันที */
  generateQr(asset: IAsset): void {
    if (asset.qrcode) {
      const ref = this.dialog.open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: 'สร้าง QR Code ใหม่',
          message: `ครุภัณฑ์ ${asset.assetNumber} มี QR Code อยู่แล้ว การสร้างใหม่จะทำให้สติกเกอร์เดิมที่เคยพิมพ์ไปแล้วสแกนไม่ได้อีกต่อไป ยืนยันหรือไม่?`,
          danger: true,
          confirmLabel: 'สร้างใหม่',
        },
      });
      ref.afterClosed().subscribe((confirmed) => {
        if (confirmed) this.doGenerateAndPreview(asset);
      });
    } else {
      this.doGenerateAndPreview(asset);
    }
  }

  private doGenerateAndPreview(asset: IAsset): void {
    this.qrCodeService.generate(asset.id).subscribe((result) => {
      this.fetch();
      this.openPreview(
        [
          {
            assetId: asset.id,
            assetNumber: result.assetNumber,
            categoryNameTh: asset.category.nameTh,
            brand: asset.brand,
            model: asset.model,
            govAssetNumber: asset.govAssetNumber,
            departmentNameTh: asset.department?.nameTh ?? null,
            imageSrc: result.dataUrl,
            scanUrl: result.scanUrl,
          },
        ],
        true,
      );
    });
  }

  /** แสดงตัวอย่างก่อนพิมพ์ — ใช้ QR เดิมถ้ามีอยู่แล้ว (ไม่ regenerate) */
  printQr(asset: IAsset): void {
    this.printing.set(true);
    this.qrCodeService.printPng(asset.id).subscribe({
      next: (blob) => {
        // หลังเรียก print แล้ว อาจมีการสร้าง QR ให้อัตโนมัติถ้ายังไม่เคยมี — ดึงข้อมูลล่าสุดเพื่อได้ token ที่ถูกต้อง
        this.assetService.getById(asset.id).subscribe((fresh) => {
          this.printing.set(false);
          const imageSrc = URL.createObjectURL(blob);
          const scanUrl = fresh.qrcode ? this.qrCodeService.buildScanUrl(fresh.qrcode.qrToken) : '';
          this.openPreview([
            {
              assetId: fresh.id,
              assetNumber: fresh.assetNumber,
              categoryNameTh: fresh.category.nameTh,
              brand: fresh.brand,
              model: fresh.model,
              govAssetNumber: fresh.govAssetNumber,
              departmentNameTh: fresh.department?.nameTh ?? null,
              imageSrc,
              scanUrl,
            },
          ]);
        });
      },
      error: () => this.printing.set(false),
    });
  }

  printSelected(): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    this.printing.set(true);
    this.qrCodeService.bulkPrint(ids).subscribe({
      next: (results) => {
        this.assetService.list({ page: 1, limit: 100 }).subscribe((res) => {
          this.printing.set(false);
          const byId = new Map(res.items.map((a) => [a.id, a]));
          const items: IQrLabelData[] = results
            .map((r) => {
              const asset = byId.get(r.assetId) ?? this.assets().find((a) => a.id === r.assetId);
              if (!asset) return null;
              return {
                assetId: r.assetId,
                assetNumber: r.assetNumber,
                categoryNameTh: asset.category.nameTh,
                brand: asset.brand,
                model: asset.model,
                govAssetNumber: asset.govAssetNumber,
                departmentNameTh: asset.department?.nameTh ?? null,
                imageSrc: r.dataUrl,
                scanUrl: asset.qrcode ? this.qrCodeService.buildScanUrl(asset.qrcode.qrToken) : '',
              } satisfies IQrLabelData;
            })
            .filter((x): x is IQrLabelData => x !== null);
          this.openPreview(items);
        });
      },
      error: () => {
        this.printing.set(false);
        this.snackBar.open('พิมพ์ QR แบบหลายรายการไม่สำเร็จ', 'ปิด', { duration: 3000 });
      },
    });
  }

  private openPreview(items: IQrLabelData[], regenerated = false): void {
    this.dialog.open(QrPrintPreviewComponent, {
      width: '900px',
      maxWidth: '95vw',
      data: { items, regenerated },
    });
  }

  deleteAsset(asset: IAsset): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '380px',
      data: { title: 'ลบครุภัณฑ์', message: `ยืนยันการลบครุภัณฑ์ ${asset.assetNumber} ใช่หรือไม่?`, danger: true },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.assetService.remove(asset.id).subscribe(() => this.fetch());
      }
    });
  }

  private currentFilter() {
    return {
      keyword: this.keyword || undefined,
      categoryId: this.categoryId || undefined,
      departmentId: this.departmentId || undefined,
      status: this.status || undefined,
      acquisitionType: this.acquisitionType || undefined,
      budgetYear: this.budgetYear || undefined,
      externalSource: this.externalSource || undefined,
    };
  }

  exportExcel(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.assetService.exportFile(this.currentFilter(), 'xlsx').subscribe({
      next: (blob) => {
        downloadBlob(blob, `assets-${Date.now()}.xlsx`);
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
    this.assetService.exportFile(this.currentFilter(), 'csv').subscribe({
      next: (blob) => {
        downloadBlob(blob, `assets-${Date.now()}.csv`);
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
      const res = await firstValueFrom(this.assetService.list({ ...this.currentFilter(), page: 1, limit: EXPORT_PDF_MAX_ROWS }));
      await exportTableToPdf({
        title: 'รายงานครุภัณฑ์',
        subtitle: `ทั้งหมด ${res.items.length} รายการ${res.meta.total > res.items.length ? ` (จากทั้งหมด ${res.meta.total} รายการ)` : ''}`,
        columns: ['เลขครุภัณฑ์', 'ประเภท', 'ยี่ห้อ/รุ่น', 'สถานะ', 'ประเภทการได้มา', 'หน่วยงาน', 'ผู้รับผิดชอบ', 'สถานที่'],
        rows: res.items.map((a) => [
          a.assetNumber,
          a.category.nameTh,
          [a.brand, a.model].filter(Boolean).join(' / '),
          getStatusLabel(a.status),
          getAcquisitionTypeLabel(a.acquisitionType),
          a.department?.nameTh ?? '',
          a.owner?.fullName ?? '',
          [a.building?.name, a.floor?.name, a.room?.name].filter(Boolean).join(' / '),
        ]),
        filename: `assets-${Date.now()}.pdf`,
      });
    } catch {
      this.snackBar.open('Export PDF ไม่สำเร็จ', 'ปิด', { duration: 3000 });
    } finally {
      this.exporting.set(false);
    }
  }
}
