import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
import type { IPinDevice, IPinStatusResponse } from '../../../core/models/auth.model';
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

/** สถานะที่แสดงผลได้จริง — คำนวณจาก pinStatus (ความจริงจาก server) + setupFormOpen (เจตนา UI ล้วนๆ) เท่านั้น
 * ไม่มี state ไหนถูก "เดา" ไว้ล่วงหน้าก่อนรู้ผลจริง จึงไม่มีทางแสดงผลขัดกับความจริงได้ (ต่างจากสวิตช์ตัวเดียวเดิม
 * ที่ผสมทั้งสองความหมายไว้ในตัวแปรเดียว ทำให้ต้อง "เดาแล้วค่อย revert" และพลาดบางเส้นทางจนค้างผิดสถานะ) */
type PinCardState = 'never-configured' | 'disabled-with-history' | 'active' | 'setup-form';

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

  readonly checkingStatus = signal(true);
  readonly statusLoadError = signal(false);
  /** ความจริงจาก server ล้วนๆ — เปลี่ยนค่าเฉพาะตอนโหลดหน้าครั้งแรก และตอน mutation (ตั้งค่า/เปิดใช้งานอีกครั้ง/
   * ปิดใช้งาน) สำเร็จจริงเท่านั้น ไม่มีการ set แบบ "เดาไปก่อน" เลยสักจุด จึงไม่มี state ให้ต้องคอย revert */
  readonly pinStatus = signal<IPinStatusResponse | null>(null);

  /** เจตนาฝั่ง UI ล้วนๆ — ไม่เคยแทนความจริงของ server เลย แค่บอกว่ากำลังเปิดฟอร์มตั้ง PIN อยู่หรือไม่ */
  readonly setupFormOpen = signal(false);
  /** true เมื่อเปิดฟอร์มจากปุ่ม "ตั้ง PIN ใหม่แทน" (มีประวัติ PIN เดิมอยู่) — ใช้แค่เปลี่ยนข้อความอธิบายในฟอร์ม */
  readonly setupFormReplacesHistory = signal(false);

  /** ปุ่มที่ยิง API โดยตรง (เปิดใช้งานอีกครั้ง/ปิดใช้งาน) — ฟอร์มตั้ง PIN มี saving() ของตัวเองแยกต่างหาก */
  readonly actionPending = signal(false);

  readonly savedMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly devicesLoading = signal(true);
  readonly devices = signal<IPinDevice[]>([]);

  readonly cardState = computed<PinCardState>(() => {
    if (this.setupFormOpen()) return 'setup-form';
    const status = this.pinStatus();
    if (status?.available) return 'active';
    if (status?.hasHistory) return 'disabled-with-history';
    return 'never-configured';
  });

  readonly form = this.fb.nonNullable.group(
    {
      password: ['', Validators.required],
      pin: ['', [Validators.required, Validators.pattern(/^\d{6}$/), weakPinValidator]],
      confirmPin: ['', Validators.required],
    },
    { validators: pinsMatchValidator },
  );

  readonly saving = signal(false);

  constructor() {
    this.loadStatus();
    this.loadDevices();
  }

  loadStatus(): void {
    this.checkingStatus.set(true);
    this.statusLoadError.set(false);
    this.authService.getMyPinStatus().subscribe({
      next: (status) => {
        this.pinStatus.set(status);
        this.checkingStatus.set(false);
      },
      error: () => {
        this.statusLoadError.set(true);
        this.checkingStatus.set(false);
      },
    });
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

  openSetupForm(replacesHistory: boolean): void {
    this.errorMessage.set(null);
    this.savedMessage.set(null);
    this.setupFormReplacesHistory.set(replacesHistory);
    this.setupFormOpen.set(true);
  }

  cancelSetupForm(): void {
    this.setupFormOpen.set(false);
    this.errorMessage.set(null);
    this.form.reset();
  }

  submit(): void {
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    this.errorMessage.set(null);
    this.savedMessage.set(null);

    const { password, pin } = this.form.getRawValue();
    this.authService.setupPin({ password, pin }).subscribe({
      next: () => {
        this.saving.set(false);
        this.setupFormOpen.set(false);
        this.form.reset();
        this.savedMessage.set('ตั้งค่า PIN สำหรับเครื่องนี้เรียบร้อยแล้ว ครั้งต่อไปที่เข้าสู่ระบบบนเครื่องนี้จะกรอกแค่ PIN ได้เลย');
        this.loadStatus();
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

  confirmReactivate(): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '380px',
      data: {
        title: 'เปิดใช้งาน PIN อีกครั้ง',
        message: 'เครื่องนี้เคยตั้งค่า PIN ไว้ก่อนหน้านี้ ยืนยันเพื่อเปิดใช้งาน PIN เดิมอีกครั้ง',
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.errorMessage.set(null);
      this.savedMessage.set(null);
      this.actionPending.set(true);
      this.authService.reactivateCurrentDevicePin().subscribe({
        next: () => {
          this.actionPending.set(false);
          this.savedMessage.set('เปิดใช้งาน PIN สำหรับเครื่องนี้เรียบร้อยแล้ว');
          this.loadStatus();
          this.loadDevices();
        },
        error: (err) => {
          this.actionPending.set(false);
          this.errorMessage.set(err?.error?.error?.message ?? 'เปิดใช้งาน PIN ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        },
      });
    });
  }

  confirmDisable(): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '380px',
      data: {
        title: 'ปิดใช้งาน PIN',
        message: 'ปิดใช้งาน PIN สำหรับเครื่องนี้ใช่หรือไม่? ครั้งต่อไปจะต้องเข้าสู่ระบบด้วยรหัสผ่านแทน',
        danger: true,
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.errorMessage.set(null);
      this.savedMessage.set(null);
      this.actionPending.set(true);
      this.authService.disableCurrentDevicePin().subscribe({
        next: () => {
          this.actionPending.set(false);
          this.savedMessage.set('ปิดใช้งาน PIN สำหรับเครื่องนี้เรียบร้อยแล้ว');
          this.loadStatus();
          this.loadDevices();
        },
        error: (err) => {
          this.actionPending.set(false);
          this.errorMessage.set(err?.error?.error?.message ?? 'ปิดใช้งาน PIN ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        },
      });
    });
  }

  revokeDevice(device: IPinDevice): void {
    const consequence = device.isCurrentDevice
      ? 'เครื่องนี้จะต้องเข้าสู่ระบบด้วยรหัสผ่าน และต้อง "ตั้งค่า PIN ใหม่ทั้งหมด" อีกครั้งหากต้องการใช้ PIN — ระบบจะไม่จำประวัติ PIN เดิมของเครื่องนี้ให้เปิดใช้งานกลับมาได้เฉยๆ'
      : 'เครื่องนั้นจะต้องเข้าสู่ระบบด้วยรหัสผ่านอีกครั้ง';
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '380px',
      data: {
        title: 'ลืมอุปกรณ์นี้',
        message: `ยกเลิก PIN ของ "${device.deviceLabel ?? 'อุปกรณ์นี้'}" ใช่หรือไม่? ${consequence}`,
        danger: true,
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.authService.revokePinDevice(device.id).subscribe(() => {
          if (device.isCurrentDevice) {
            this.authService.clearPinLoginMarker();
            this.loadStatus();
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
        message:
          'ยกเลิก PIN ของทุกอุปกรณ์ที่เคยตั้งค่าไว้ใช่หรือไม่? ทุกเครื่อง (รวมถึงเครื่องนี้) จะต้องเข้าสู่ระบบด้วยรหัสผ่าน และต้อง "ตั้งค่า PIN ใหม่ทั้งหมด" อีกครั้งหากต้องการกลับมาใช้ PIN — ระบบจะไม่จำประวัติ PIN เดิมให้เปิดใช้งานกลับมาได้เฉยๆ',
        danger: true,
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.authService.disablePin().subscribe(() => {
          this.loadStatus();
          this.loadDevices();
        });
      }
    });
  }

  formatDate(iso: string | null): string {
    return iso ? new Date(iso).toLocaleString('th-TH') : '—';
  }
}
