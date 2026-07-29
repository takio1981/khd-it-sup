import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, type AbstractControl, type ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';
import { PageWatermarkComponent } from '../../../shared/components/page-watermark/page-watermark.component';
import { environment } from '../../../../environments/environment';

function passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value as string;
  if (!value) return null;
  const errors: ValidationErrors = {};
  if (value.length < 8) errors['minLength'] = true;
  if (!/[A-Z]/.test(value)) errors['upper'] = true;
  if (!/[a-z]/.test(value)) errors['lower'] = true;
  if (!/[0-9]/.test(value)) errors['digit'] = true;
  return Object.keys(errors).length ? errors : null;
}

function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const newPassword = group.get('newPassword')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  return newPassword && confirmPassword && newPassword !== confirmPassword ? { mismatch: true } : null;
}

@Component({
  selector: 'khd-change-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatProgressSpinnerModule, PageWatermarkComponent],
  templateUrl: './change-password.component.html',
})
export class ChangePasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly orgName = environment.orgNameTh;
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly forced = this.authService.currentUser()?.mustChangePassword ?? false;

  readonly form = this.fb.nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, passwordStrengthValidator]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatchValidator },
  );

  submit(): void {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService.changePassword(this.form.getRawValue()).subscribe({
      next: () => {
        // backend เพิกถอน refresh token ทั้งหมดหลังเปลี่ยนรหัสผ่านสำเร็จ (ความปลอดภัย) —
        // ให้ผู้ใช้เข้าสู่ระบบใหม่ด้วยรหัสผ่านใหม่แทนการพยายาม refresh session เดิม
        this.authService.logout();
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err?.error?.error?.message ?? 'เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      },
    });
  }
}
