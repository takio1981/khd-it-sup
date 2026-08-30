import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, type AbstractControl, type ValidationErrors } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';
import { PageWatermarkComponent } from '../../../shared/components/page-watermark/page-watermark.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PinInputComponent } from '../../../shared/components/pin-input/pin-input.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import type { IPinDevice } from '../../../core/models/auth.model';
import { environment } from '../../../../environments/environment';

function pinsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const pin = group.get('pin')?.value;
  const confirmPin = group.get('confirmPin')?.value;
  return pin && confirmPin && pin !== confirmPin ? { mismatch: true } : null;
}

/** ต้องตรงกับ isWeakPin ฝั่ง backend เสมอ (auth.dto.ts) — เช็คซ้ำที่นี่เพื่อบอกผู้ใช้ทันทีแทนที่จะรอ 422 จาก server */
function weakPinValidator(control: AbstractControl): ValidationErrors | null {
  const pin = control.value as string;
  if (!pin || pin.length !== 6) return null;
  const isWeak = /^(\d)\1{5}$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin);
  return isWeak ? { weak: true } : null;
}

@Component({
  selector: 'khd-setup-pin',
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
    PinInputComponent,
  ],
  templateUrl: './setup-pin.component.html',
})
export class SetupPinComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);

  readonly orgName = environment.orgNameTh;

  readonly saving = signal(false);
  readonly savedMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly devicesLoading = signal(true);
  readonly devices = signal<IPinDevice[]>([]);

  readonly form = this.fb.nonNullable.group(
    {
      password: ['', Validators.required],
      pin: ['', [Validators.required, Validators.pattern(/^\d{6}$/), weakPinValidator]],
      confirmPin: ['', Validators.required],
    },
    { validators: pinsMatchValidator },
  );

  constructor() {
    this.loadDevices();
  }

  private loadDevices(): void {
    this.devicesLoading.set(true);
    this.authService.listPinDevices().subscribe({
      next: (devices) => {
        this.devices.set(devices);
        this.devicesLoading.set(false);
      },
      error: () => this.devicesLoading.set(false),
    });
  }

  submit(): void {
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    this.savedMessage.set(null);
    this.errorMessage.set(null);

    const { password, pin } = this.form.getRawValue();
    this.authService.setupPin({ password, pin }).subscribe({
      next: () => {
        this.saving.set(false);
        this.savedMessage.set('ตั้งค่า PIN สำหรับเครื่องนี้เรียบร้อยแล้ว ครั้งต่อไปที่เข้าสู่ระบบบนเครื่องนี้จะกรอกแค่ PIN ได้เลย');
        this.form.reset();
        this.loadDevices();
      },
      error: (err) => {
        this.saving.set(false);
        const fieldErrors = err?.error?.error?.details?.fieldErrors as Record<string, string[]> | undefined;
        const specific = fieldErrors?.['pin']?.[0] ?? fieldErrors?.['password']?.[0];
        this.errorMessage.set(specific ?? err?.error?.error?.message ?? 'ตั้งค่า PIN ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      },
    });
  }

  revokeDevice(device: IPinDevice): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '380px',
      data: {
        title: 'ลืมอุปกรณ์นี้',
        message: `ยกเลิก PIN ของ "${device.deviceLabel ?? 'อุปกรณ์นี้'}" ใช่หรือไม่? เครื่องนี้จะต้องเข้าสู่ระบบด้วยรหัสผ่านอีกครั้ง`,
        danger: true,
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.authService.revokePinDevice(device.id).subscribe(() => {
          if (device.isCurrentDevice) this.authService.clearPinLoginMarker();
          this.loadDevices();
        });
      }
    });
  }

  disableAll(): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '380px',
      data: {
        title: 'ปิดใช้งาน PIN ทุกอุปกรณ์',
        message: 'ยกเลิก PIN ของทุกอุปกรณ์ที่เคยตั้งค่าไว้ใช่หรือไม่? ทุกเครื่องจะต้องเข้าสู่ระบบด้วยรหัสผ่านอีกครั้ง',
        danger: true,
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.authService.disablePin().subscribe(() => this.loadDevices());
      }
    });
  }

  formatDate(iso: string | null): string {
    return iso ? new Date(iso).toLocaleString('th-TH') : '—';
  }
}
