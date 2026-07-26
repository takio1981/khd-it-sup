import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { DivisionService } from '../../core/services/division.service';
import { DepartmentService } from '../../core/services/department.service';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import type { IDepartment, IDivision } from '../../core/models/user.model';

@Component({
  selector: 'khd-division-list',
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
    IconComponent,
    HasPermissionDirective,
  ],
  templateUrl: './division-list.component.html',
})
export class DivisionListComponent {
  private readonly fb = inject(FormBuilder);
  private readonly divisionService = inject(DivisionService);
  private readonly departmentService = inject(DepartmentService);
  private readonly dialog = inject(MatDialog);

  readonly displayedColumns = ['code', 'nameTh', 'nameEn', 'department', 'actions'];
  readonly divisions = signal<IDivision[]>([]);
  readonly departments = signal<IDepartment[]>([]);
  readonly showForm = signal(false);
  readonly saving = signal(false);
  readonly editingId = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    code: ['', Validators.required],
    nameTh: ['', Validators.required],
    nameEn: [''],
    departmentId: ['', Validators.required],
  });

  constructor() {
    this.fetch();
    this.departmentService.list().subscribe((departments) => this.departments.set(departments));
  }

  fetch(): void {
    this.divisionService.list().subscribe((divisions) => this.divisions.set(divisions));
  }

  openCreateForm(): void {
    this.editingId.set(null);
    this.form.reset({ code: '', nameTh: '', nameEn: '', departmentId: '' });
    this.form.get('code')?.enable();
    this.showForm.set(true);
  }

  openEditForm(division: IDivision): void {
    this.editingId.set(division.id);
    this.form.reset({ code: division.code, nameTh: division.nameTh, nameEn: division.nameEn ?? '', departmentId: division.departmentId });
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
    const { nameTh, nameEn, departmentId } = this.form.getRawValue();
    const request = editing
      ? this.divisionService.update(editing, { nameTh, nameEn, departmentId })
      : this.divisionService.create(this.form.getRawValue());

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.editingId.set(null);
        this.form.reset({ code: '', nameTh: '', nameEn: '', departmentId: '' });
        this.fetch();
      },
      error: () => this.saving.set(false),
    });
  }

  deleteDivision(division: IDivision): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'ปิดใช้งานแผนก',
        message: `ยืนยันการปิดใช้งานแผนก ${division.nameTh} ใช่หรือไม่?`,
        danger: true,
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.divisionService.remove(division.id).subscribe(() => this.fetch());
      }
    });
  }
}
