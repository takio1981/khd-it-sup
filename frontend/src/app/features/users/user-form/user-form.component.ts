import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { UserService, type IRole } from '../../../core/services/user.service';
import { DepartmentService } from '../../../core/services/department.service';
import { PositionService } from '../../../core/services/position.service';
import { UserAvatarComponent } from '../../../shared/components/user-avatar/user-avatar.component';
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
    MatCheckboxModule,
    MatProgressSpinnerModule,
    UserAvatarComponent,
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

  @ViewChild('avatarInput') avatarInput?: ElementRef<HTMLInputElement>;

  readonly isEdit = !!this.data.user;
  readonly saving = signal(false);
  readonly roles = signal<IRole[]>([]);
  readonly departments = signal<IDepartment[]>([]);
  readonly positions = signal<IPosition[]>([]);

  readonly avatarUrl = signal<string | null>(this.data.user?.avatarUrl ?? null);
  readonly uploadingAvatar = signal(false);

  readonly form = this.fb.nonNullable.group({
    username: [{ value: this.data.user?.username ?? '', disabled: this.isEdit }, Validators.required],
    email: [this.data.user?.email ?? '', [Validators.required, Validators.email]],
    password: ['', this.isEdit ? [] : [Validators.required, Validators.minLength(8)]],
    fullName: [this.data.user?.fullName ?? '', Validators.required],
    phone: [this.data.user?.phone ?? ''],
    gender: this.fb.nonNullable.control<'MALE' | 'FEMALE' | ''>(this.data.user?.gender ?? ''),
    roleId: [this.data.user?.role.id ?? '', Validators.required],
    departmentId: [this.data.user?.department?.id ?? ''],
    positionId: [this.data.user?.position?.id ?? ''],
    isUnitHead: [this.data.user?.isUnitHead ?? false],
  });

  readonly genderPreview = toSignal(this.form.controls.gender.valueChanges, { initialValue: this.form.controls.gender.value });

  constructor() {
    this.userService.listRoles().subscribe((roles) => this.roles.set(roles));
    this.departmentService.list().subscribe((depts) => this.departments.set(depts));
    this.positionService.list().subscribe((positions) => this.positions.set(positions));
  }

  submit(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    const { username, password, departmentId, positionId, gender, ...rest } = this.form.getRawValue();
    const payload = {
      ...rest,
      gender: (gender || undefined) as 'MALE' | 'FEMALE' | undefined,
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

  triggerAvatarInput(): void {
    this.avatarInput?.nativeElement.click();
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.data.user) return;

    this.uploadingAvatar.set(true);
    this.userService.uploadAvatar(this.data.user.id, file).subscribe({
      next: (user) => {
        this.avatarUrl.set(user.avatarUrl);
        this.uploadingAvatar.set(false);
        input.value = '';
      },
      error: () => {
        this.uploadingAvatar.set(false);
        input.value = '';
      },
    });
  }

  removeAvatar(): void {
    if (!this.data.user) return;
    this.uploadingAvatar.set(true);
    this.userService.removeAvatar(this.data.user.id).subscribe({
      next: (user) => {
        this.avatarUrl.set(user.avatarUrl);
        this.uploadingAvatar.set(false);
      },
      error: () => this.uploadingAvatar.set(false),
    });
  }
}
