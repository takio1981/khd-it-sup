import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DepartmentService } from '../../core/services/department.service';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { downloadBlob } from '../../core/utils/download.util';
import { exportTableToPdf } from '../../core/utils/pdf-table-export.util';
import type { IDepartment } from '../../core/models/user.model';

@Component({
  selector: 'khd-department-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatMenuModule,
    IconComponent,
    HasPermissionDirective,
  ],
  templateUrl: './department-list.component.html',
})
export class DepartmentListComponent {
  private readonly fb = inject(FormBuilder);
  private readonly departmentService = inject(DepartmentService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly displayedColumns = ['code', 'nameTh', 'parent', 'actions'];
  readonly departments = signal<IDepartment[]>([]);
  readonly showForm = signal(false);
  readonly saving = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly exporting = signal(false);

  /** ตัวเลือก "หน่วยงานแม่" ตอนแก้ไข ต้องไม่รวมตัวเอง (กันเลือกตัวเองเป็น parent) */
  readonly parentOptions = computed(() => {
    const editing = this.editingId();
    return this.departments().filter((d) => d.id !== editing);
  });

  readonly form = this.fb.nonNullable.group({
    code: ['', Validators.required],
    nameTh: ['', Validators.required],
    nameEn: [''],
    parentId: [''],
  });

  constructor() {
    this.fetch();
  }

  fetch(): void {
    this.departmentService.list().subscribe((depts) => this.departments.set(depts));
  }

  parentName(parentId: string | null): string {
    if (!parentId) return '-';
    return this.departments().find((d) => d.id === parentId)?.nameTh ?? '-';
  }

  openCreateForm(): void {
    this.editingId.set(null);
    this.form.reset({ code: '', nameTh: '', nameEn: '', parentId: '' });
    this.form.get('code')?.enable();
    this.showForm.set(true);
  }

  openEditForm(dept: IDepartment): void {
    this.editingId.set(dept.id);
    this.form.reset({
      code: dept.code,
      nameTh: dept.nameTh,
      nameEn: dept.nameEn ?? '',
      parentId: dept.parentId ?? '',
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
    const { nameTh, nameEn, parentId } = this.form.getRawValue();
    const request = editing
      ? this.departmentService.update(editing, { nameTh, nameEn, parentId: parentId || null })
      : this.departmentService.create(this.form.getRawValue());

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.editingId.set(null);
        this.form.reset({ code: '', nameTh: '', nameEn: '', parentId: '' });
        this.fetch();
      },
      error: () => this.saving.set(false),
    });
  }

  exportExcel(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.departmentService.exportFile('xlsx').subscribe({
      next: (blob) => {
        downloadBlob(blob, `departments-${Date.now()}.xlsx`);
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
    this.departmentService.exportFile('csv').subscribe({
      next: (blob) => {
        downloadBlob(blob, `departments-${Date.now()}.csv`);
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
      const items = this.departments();
      await exportTableToPdf({
        title: 'รายงานหน่วยงาน',
        subtitle: `ทั้งหมด ${items.length} หน่วยงาน`,
        columns: ['รหัส', 'ชื่อหน่วยงาน', 'หน่วยงานแม่'],
        rows: items.map((d) => [d.code, d.nameTh, this.parentName(d.parentId)]),
        filename: `departments-${Date.now()}.pdf`,
      });
    } catch {
      this.snackBar.open('Export PDF ไม่สำเร็จ', 'ปิด', { duration: 3000 });
    } finally {
      this.exporting.set(false);
    }
  }

  deleteDepartment(dept: IDepartment): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '380px',
      data: { title: 'ปิดใช้งานหน่วยงาน', message: `ยืนยันการปิดใช้งานหน่วยงาน ${dept.nameTh} ใช่หรือไม่?`, danger: true },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.departmentService.remove(dept.id).subscribe(() => this.fetch());
      }
    });
  }
}
