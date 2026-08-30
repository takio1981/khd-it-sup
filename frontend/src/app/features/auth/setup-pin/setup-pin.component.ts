import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, type AbstractControl, type ValidationErrors } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule, type MatSlideToggleChange } from '@angular/material/slide-toggle';
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
    MatSlideToggleModule,
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

  /** สถานะสวิตช์หลัก — สะท้อนว่าเครื่องนี้ใช้ PIN เข้าสู่ระบบอยู่หรือไม่ (ตรวจกับ server จริงตอนโหลดหน้า) */
  readonly checkingStatus = signal(true);
  readonly pinEnabled = signal(false);
  /** เปิดฟอร์มตั้ง PIN เมื่อสลับสวิตช์เป็นเปิดแต่เครื่องนี้ยังไม่เคยตั้ง PIN ไว้ */
  readonly showSetupForm = signal(false);

  readonly saving = signal(false);
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
    this.authService.getPinStatus().subscribe({
      next: (status) => {
        this.pinEnabled.set(status.available);
        this.checkingStatus.set(false);
      },
      error: () => this.checkingStatus.set(false),
    });
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

  onToggleChange(event: MatSlideToggleChange): void {
    // mat-slide-toggle พลิกสถานะแสดงผลของตัวเองทันทีตอนคลิก (optimistic) โดยไม่รอ Angular — ต้องอัปเดต
    // signal ให้ตรงตามนั้นทันทีด้วย ไม่งั้นตอนยกเลิก (set กลับเป็นค่าเดิม) จะไม่เกิดการเปลี่ยนแปลงของ signal
    // เลย (ค่าเดิม == ค่าที่ set) ทำให้ template ไม่ re-render และสวิตช์ค้างอยู่ในสถานะที่คลิกไปแล้วผิดๆ
    this.pinEnabled.set(event.checked);
    if (event.checked) {
      this.handleEnable();
    } else {
      this.handleDisable();
    }
  }

  private handleEnable(): void {
    this.errorMessage.set(null);
    // เช็คสถานะจริงกับ server อีกครั้งตอนกดเปิด เผื่อข้อมูลที่โหลดไว้ตอนแรกเก่าไปแล้ว
    this.authService.getPinStatus().subscribe({
      next: (status) => {
        if (status.available) {
          this.confirmAndLogout(
            'ใช้งาน PIN บนเครื่องนี้',
            'เครื่องนี้ตั้งค่า PIN ไว้แล้ว ยืนยันเพื่อออกจากระบบแล้วเข้าสู่ระบบด้วย PIN ในครั้งถัดไป',
          );
        } else if (status.hasHistory) {
          // เคยตั้งค่า PIN บนเครื่องนี้มาก่อน (ปิดไว้/หมดอายุ) — เปิดใช้งาน PIN เดิมกลับมาได้เลย ไม่ต้องตั้งใหม่
          const ref = this.dialog.open(ConfirmDialogComponent, {
            width: '380px',
            data: {
              title: 'ใช้งาน PIN บนเครื่องนี้',
              message: 'เครื่องนี้เคยตั้งค่า PIN ไว้ก่อนหน้านี้ ยืนยันเพื่อเปิดใช้งาน PIN เดิมอีกครั้งแล้วออกจากระบบเพื่อเข้าใช้งานด้วย PIN',
            },
          });
          ref.afterClosed().subscribe((confirmed) => {
            if (!confirmed) {
              this.pinEnabled.set(false);
              return;
            }
            this.authService.reactivateCurrentDevicePin().subscribe({
              next: () => this.authService.logout(),
              error: (err) => {
                this.pinEnabled.set(false);
                this.errorMessage.set(err?.error?.error?.message ?? 'เปิดใช้งาน PIN ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
              },
            });
          });
        } else {
          this.pinEnabled.set(true);
          this.showSetupForm.set(true);
        }
      },
      error: () => this.pinEnabled.set(false),
    });
  }

  /** เปิด confirm dialog แล้ว logout ทันทีถ้ายืนยัน หรือ revert สวิตช์กลับถ้ายกเลิก — ใช้ตอน PIN พร้อมใช้งานอยู่แล้ว */
  private confirmAndLogout(title: string, message: string): void {
    const ref = this.dialog.open(ConfirmDialogComponent, { width: '380px', data: { title, message } });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.authService.logout();
      } else {
        this.pinEnabled.set(false);
      }
    });
  }

  private handleDisable(): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '380px',
      data: {
        title: 'ปิดใช้งาน PIN',
        message: 'ปิดใช้งาน PIN สำหรับเครื่องนี้ใช่หรือไม่? ครั้งต่อไปจะต้องเข้าสู่ระบบด้วยรหัสผ่านแทน',
        danger: true,
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.authService.disableCurrentDevicePin().subscribe(() => this.authService.logout());
      } else {
        this.pinEnabled.set(true);
      }
    });
  }

  cancelSetupForm(): void {
    this.showSetupForm.set(false);
    this.pinEnabled.set(false);
    this.errorMessage.set(null);
    this.form.reset();
  }

  submit(): void {
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    this.errorMessage.set(null);

    const { password, pin } = this.form.getRawValue();
    this.authService.setupPin({ password, pin }).subscribe({
      next: () => {
        // ตั้งค่า PIN สำเร็จ — ออกจากระบบทันทีเพื่อให้ครั้งถัดไปเข้าสู่ระบบด้วย PIN ได้เลย
        this.authService.logout();
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
        message: `ยกเลิก PIN ของ "${device.deviceLabel ?? 'อุปกรณ์นี้'}" ใช่หรือไม่? เครื่องนั้นจะต้องเข้าสู่ระบบด้วยรหัสผ่านอีกครั้ง`,
        danger: true,
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.authService.revokePinDevice(device.id).subscribe(() => {
          if (device.isCurrentDevice) {
            this.authService.clearPinLoginMarker();
            this.pinEnabled.set(false);
          }
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
        this.authService.disablePin().subscribe(() => {
          this.pinEnabled.set(false);
          this.loadDevices();
        });
      }
    });
  }

  formatDate(iso: string | null): string {
    return iso ? new Date(iso).toLocaleString('th-TH') : '—';
  }
}
