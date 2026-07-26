import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AssetService } from '../../../core/services/asset.service';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import type { IAssetCategory } from '../../../core/models/asset.model';

@Component({
  selector: 'khd-asset-category-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatButtonModule,
    IconComponent,
    HasPermissionDirective,
  ],
  templateUrl: './asset-category-list.component.html',
})
export class AssetCategoryListComponent {
  private readonly fb = inject(FormBuilder);
  private readonly assetService = inject(AssetService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly displayedColumns = ['code', 'nameTh', 'nameEn', 'requiresSerial', 'actions'];
  readonly categories = signal<IAssetCategory[]>([]);
  readonly showForm = signal(false);
  readonly saving = signal(false);
  readonly editingId = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    code: ['', Validators.required],
    nameTh: ['', Validators.required],
    nameEn: ['', Validators.required],
    icon: [''],
    requiresSerial: [true],
  });

  constructor() {
    this.fetch();
  }

  fetch(): void {
    this.assetService.getCategories().subscribe((cats) => this.categories.set(cats));
  }

  openCreateForm(): void {
    this.editingId.set(null);
    this.form.reset({ code: '', nameTh: '', nameEn: '', icon: '', requiresSerial: true });
    this.form.get('code')?.enable();
    this.showForm.set(true);
  }

  openEditForm(cat: IAssetCategory): void {
    this.editingId.set(cat.id);
    this.form.reset({
      code: cat.code,
      nameTh: cat.nameTh,
      nameEn: cat.nameEn,
      icon: cat.icon ?? '',
      requiresSerial: cat.requiresSerial,
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
    const { nameTh, nameEn, icon, requiresSerial } = this.form.getRawValue();
    const request = editing
      ? this.assetService.updateCategory(editing, { nameTh, nameEn, icon: icon || undefined, requiresSerial })
      : this.assetService.createCategory(this.form.getRawValue());

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

  deleteCategory(cat: IAssetCategory): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'ปิดใช้งานประเภทครุภัณฑ์',
        message: `ยืนยันการปิดใช้งานประเภทครุภัณฑ์ ${cat.nameTh} ใช่หรือไม่? (ต้องไม่มีครุภัณฑ์ผูกอยู่กับประเภทนี้)`,
        danger: true,
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.assetService.removeCategory(cat.id).subscribe({
        next: () => this.fetch(),
        error: (err) => {
          const message = err?.error?.error?.message ?? 'ไม่สามารถปิดใช้งานประเภทครุภัณฑ์นี้ได้';
          this.snackBar.open(message, 'ปิด', { duration: 4000 });
        },
      });
    });
  }
}
