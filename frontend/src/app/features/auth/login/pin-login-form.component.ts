import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';
import { UserAvatarComponent } from '../../../shared/components/user-avatar/user-avatar.component';
import { PinInputComponent } from '../../../shared/components/pin-input/pin-input.component';

/** อุปกรณ์นี้ใช้ PIN ต่อไม่ได้แล้ว — เคลียร์ marker แล้วสลับกลับฟอร์มรหัสผ่านให้ผู้ใช้เอง */
const FALLBACK_ERROR_CODES = new Set(['PIN_REVOKED', 'PIN_EXPIRED', 'PIN_DEVICE_UNKNOWN', 'PIN_DEVICE_MISSING']);

@Component({
  selector: 'khd-pin-login-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatButtonModule, MatProgressSpinnerModule, UserAvatarComponent, PinInputComponent],
  templateUrl: './pin-login-form.component.html',
})
export class PinLoginFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** ให้ parent (LoginComponent) สลับกลับไปฟอร์ม user/password — message ไม่ null หมายถึงต้องแสดงเหตุผลด้วย */
  readonly usePassword = output<string | null>();

  readonly marker = this.authService.getPinLoginMarker();
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({ pin: [''] });

  submit(pin: string): void {
    if (this.loading() || pin.length !== 6) return;

    this.loading.set(true);
    this.errorMessage.set(null);
    this.form.disable({ emitEvent: false });

    this.authService.loginWithPin({ pin }).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
        void this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.loading.set(false);
        this.form.enable({ emitEvent: false });

        const code = err?.error?.error?.code as string | undefined;
        const message: string = err?.error?.error?.message ?? 'เข้าสู่ระบบด้วย PIN ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';

        if (code && FALLBACK_ERROR_CODES.has(code)) {
          this.authService.clearPinLoginMarker();
          this.usePassword.emit(message);
          return;
        }

        this.errorMessage.set(message);
        if (code !== 'PIN_LOCKED') {
          this.form.reset();
        }
      },
    });
  }

  switchToPassword(): void {
    this.usePassword.emit(null);
  }
}
