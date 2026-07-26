import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { UserService, type IRole } from '../../../core/services/user.service';
import { DepartmentService } from '../../../core/services/department.service';
import { PositionService } from '../../../core/services/position.service';
import type { IDepartment, IPosition, IUserListItem } from '../../../core/models/user.model';

export interface IUserFormDialogData {
  user: IUserListItem | null;
}

@Component({
  selector: 'khd-user-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './user-form.component.html',
})
export class UserFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly departmentService = inject(DepartmentService);
  private readonly positionService = inject(PositionService);
  readonly dialogRef = inject(MatDialogRef<UserFormComponent>);
  readonly data = inject<IUserFormDialogData>(MAT_DIALOG_DATA);

  readonly isEdit = !!this.data.user;
  readonly saving = signal(false);
  readonly roles = signal<IRole[]>([]);
  readonly departments = signal<IDepartment[]>([]);
  readonly positions = signal<IPosition[]>([]);

  readonly form = this.fb.nonNullable.group({
    username: [{ value: this.data.user?.username ?? '', disabled: this.isEdit }, Validators.required],
    email: [this.data.user?.email ?? '', [Validators.required, Validators.email]],
    password: ['', this.isEdit ? [] : [Validators.required, Validators.minLength(8)]],
    fullName: [this.data.user?.fullName ?? '', Validators.required],
    phone: [this.data.user?.phone ?? ''],
    roleId: [this.data.user?.role.id ?? '', Validators.required],
    departmentId: [this.data.user?.department?.id ?? ''],
    positionId: [this.data.user?.position?.id ?? ''],
  });

  constructor() {
    this.userService.listRoles().subscribe((roles) => this.roles.set(roles));
    this.departmentService.list().subscribe((depts) => this.departments.set(depts));
    this.positionService.list().subscribe((positions) => this.positions.set(positions));
  }

  submit(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    const { username, password, departmentId, positionId, ...rest } = this.form.getRawValue();
    const payload = {
      ...rest,
      departmentId: departmentId || undefined,
      positionId: positionId || undefined,
    };
    const request$ = this.isEdit
      ? this.userService.update(this.data.user!.id, payload)
      : this.userService.create({ username, password, ...payload });

    request$.subscribe({
      next: (user) => {
        this.saving.set(false);
        this.dialogRef.close(user);
      },
      error: () => this.saving.set(false),
    });
  }
}
