import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';
import { PageWatermarkComponent } from '../../../shared/components/page-watermark/page-watermark.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PinLoginFormComponent } from './pin-login-form.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'khd-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    PageWatermarkComponent,
    IconComponent,
    PinLoginFormComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly orgName = environment.orgNameTh;
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly hidePassword = signal(true);

  /** เครื่องนี้เคยตั้งค่า PIN ไว้แล้ว — เริ่มด้วยหน้ากรอก PIN แทนฟอร์ม user/password */
  readonly mode = signal<'pin' | 'password'>(this.authService.hasPinLoginMarker() ? 'pin' : 'password');

  readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  /** อุปกรณ์นี้ใช้ PIN ต่อไม่ได้แล้ว หรือผู้ใช้กด "เข้าสู่ระบบด้วยรหัสผ่าน" เอง */
  onUsePassword(message: string | null): void {
    this.mode.set('password');
    if (message) this.errorMessage.set(message);
  }

  submit(): void {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService.login(this.form.getRawValue()).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
        void this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err?.error?.error?.message ?? 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      },
    });
  }
}
