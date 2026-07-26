import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { PositionService } from '../../core/services/position.service';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import type { IPosition } from '../../core/models/user.model';

@Component({
  selector: 'khd-position-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    IconComponent,
    HasPermissionDirective,
  ],
  templateUrl: './position-list.component.html',
})
export class PositionListComponent {
  private readonly fb = inject(FormBuilder);
  private readonly positionService = inject(PositionService);
  private readonly dialog = inject(MatDialog);

  readonly displayedColumns = ['code', 'nameTh', 'nameEn', 'actions'];
  readonly positions = signal<IPosition[]>([]);
  readonly showForm = signal(false);
  readonly saving = signal(false);
  readonly editingId = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    code: ['', Validators.required],
    nameTh: ['', Validators.required],
    nameEn: [''],
  });

  constructor() {
    this.fetch();
  }

  fetch(): void {
    this.positionService.list().subscribe((positions) => this.positions.set(positions));
  }

  openCreateForm(): void {
    this.editingId.set(null);
    this.form.reset({ code: '', nameTh: '', nameEn: '' });
    this.form.get('code')?.enable();
    this.showForm.set(true);
  }

  openEditForm(position: IPosition): void {
    this.editingId.set(position.id);
    this.form.reset({ code: position.code, nameTh: position.nameTh, nameEn: position.nameEn ?? '' });
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
    const { nameTh, nameEn } = this.form.getRawValue();
    const request = editing
      ? this.positionService.update(editing, { nameTh, nameEn })
      : this.positionService.create(this.form.getRawValue());

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.editingId.set(null);
        this.form.reset({ code: '', nameTh: '', nameEn: '' });
        this.fetch();
      },
      error: () => this.saving.set(false),
    });
  }

  deletePosition(position: IPosition): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'ปิดใช้งานตำแหน่งงาน',
        message: `ยืนยันการปิดใช้งานตำแหน่งงาน ${position.nameTh} ใช่หรือไม่? (ต้องไม่มีผู้ใช้งานตำแหน่งนี้อยู่)`,
        danger: true,
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.positionService.remove(position.id).subscribe(() => this.fetch());
      }
    });
  }
}
