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

  /**
   * ต้องรอผลจาก server ก่อนตัดสินใจว่าจะแสดงหน้ากรอก PIN หรือฟอร์ม user/password — localStorage marker
   * เพียงอย่างเดียวไม่พอ เพราะอาจไม่ตรงกับความจริงได้ (cookie ถูกล้าง/PIN ถูกยกเลิกจากอุปกรณ์อื่น ฯลฯ)
   * ระหว่างรอผลจะยังไม่แสดงฟอร์มไหนเลย กันไม่ให้กระพริบไปมาระหว่างฟอร์มผิด/ถูก
   */
  readonly checkingPinStatus = signal(true);
  readonly mode = signal<'pin' | 'password'>('password');

  readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  constructor() {
    this.authService.getPinStatus().subscribe({
      next: (status) => {
        if (status.available && status.fullName) {
          this.authService.setPinLoginMarker({
            username: status.username ?? '',
            fullName: status.fullName,
            gender: status.gender ?? null,
            avatarUrl: status.avatarUrl ?? null,
          });
          this.mode.set('pin');
        } else {
          this.authService.clearPinLoginMarker();
          this.mode.set('password');
        }
        this.checkingPinStatus.set(false);
      },
      error: () => {
        // เช็คสถานะ PIN ไม่สำเร็จ (เช่น เน็ตหลุด) — fallback ไปฟอร์มรหัสผ่านซึ่งใช้งานได้แน่นอนที่สุด
        this.mode.set('password');
        this.checkingPinStatus.set(false);
      },
    });
  }

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
