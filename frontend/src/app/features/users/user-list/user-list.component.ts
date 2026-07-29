import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { UserAvatarComponent } from '../../../shared/components/user-avatar/user-avatar.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { UserFormComponent } from '../user-form/user-form.component';
import type { IUserListItem } from '../../../core/models/user.model';

@Component({
  selector: 'khd-user-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatMenuModule,
    MatChipsModule,
    IconComponent,
    UserAvatarComponent,
    HasPermissionDirective,
  ],
  templateUrl: './user-list.component.html',
})
export class UserListComponent {
  private readonly userService = inject(UserService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  readonly authService = inject(AuthService);

  readonly displayedColumns = ['fullName', 'username', 'role', 'department', 'status', 'actions'];
  readonly users = signal<IUserListItem[]>([]);
  readonly total = signal(0);
  readonly pageSize = signal(20);
  readonly pageIndex = signal(0);
  readonly loading = signal(true);

  keyword = '';
  private readonly keyword$ = new Subject<string>();

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
    this.userService.list({ page: this.pageIndex() + 1, limit: this.pageSize(), keyword: this.keyword || undefined }).subscribe((res) => {
      this.users.set(res.items);
      this.total.set(res.meta.total);
      this.loading.set(false);
    });
  }

  openCreateForm(): void {
    const ref = this.dialog.open(UserFormComponent, { width: '520px', data: { user: null } });
    ref.afterClosed().subscribe((result) => {
      if (!result) return;
      this.fetch();
    });
  }

  openEditForm(user: IUserListItem): void {
    const ref = this.dialog.open(UserFormComponent, { width: '520px', data: { user } });
    ref.afterClosed().subscribe((result) => {
      if (!result) return;
      this.fetch();
    });
  }

  resetPassword(user: IUserListItem): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '380px',
      data: { title: 'รีเซ็ตรหัสผ่าน', message: `รีเซ็ตรหัสผ่านของ ${user.fullName} ใช่หรือไม่?` },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.userService.resetPassword(user.id).subscribe((result) => {
        this.snackBar.open(result.message, 'ปิด', { duration: 6000 });
      });
    });
  }

  deleteUser(user: IUserListItem): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '380px',
      data: { title: 'ลบผู้ใช้', message: `ยืนยันการลบผู้ใช้ ${user.fullName} ใช่หรือไม่?`, danger: true },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.userService.remove(user.id).subscribe(() => {
          this.fetch();
        });
      }
    });
  }
}
