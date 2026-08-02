import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SettingsService } from '../../../core/services/settings.service';
import { AuthService } from '../../../core/services/auth.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import type { IOrgSettings } from '../../../core/models/settings.model';

@Component({
  selector: 'khd-general-settings-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    IconComponent,
  ],
  templateUrl: './general-settings-form.component.html',
})
export class GeneralSettingsFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly settingsService = inject(SettingsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('logoInput') logoInput?: ElementRef<HTMLInputElement>;

  readonly canManage = computed(() => this.authService.hasPermission('settings:manage'));

  readonly loading = signal(true);
  readonly savingOrg = signal(false);
  readonly savingSmtp = signal(false);
  readonly uploadingLogo = signal(false);
  readonly settings = signal<IOrgSettings | null>(null);
  readonly logoObjectUrl = signal<string | null>(null);

  readonly orgForm = this.fb.nonNullable.group({
    orgNameTh: [''],
    themeColor: ['#006C45'],
  });

  readonly smtpForm = this.fb.nonNullable.group({
    smtpHost: [''],
    smtpPort: [587],
    smtpSecure: [false],
    smtpUser: [''],
    smtpPass: [''],
    smtpFromEmail: [''],
    smtpFromName: [''],
  });

  constructor() {
    this.settingsService.getOrgSettings().subscribe((s) => this.applySettings(s));

    effect(() => {
      const url = this.settings()?.orgLogoUrl;
      this.logoObjectUrl.set(null);
      if (!url) return;
      this.settingsService.getLogoBlob(url).subscribe((blob) => this.logoObjectUrl.set(URL.createObjectURL(blob)));
    });

    this.destroyRef.onDestroy(() => {
      const url = this.logoObjectUrl();
      if (url) URL.revokeObjectURL(url);
    });
  }

  private applySettings(s: IOrgSettings): void {
    this.settings.set(s);
    this.orgForm.patchValue({ orgNameTh: s.orgNameTh, themeColor: s.themeColor });
    this.smtpForm.patchValue({
      smtpHost: s.smtpHost,
      smtpPort: s.smtpPort,
      smtpSecure: s.smtpSecure,
      smtpUser: s.smtpUser,
      smtpFromEmail: s.smtpFromEmail,
      smtpFromName: s.smtpFromName,
    });
    this.loading.set(false);
  }

  triggerLogoInput(): void {
    this.logoInput?.nativeElement.click();
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadingLogo.set(true);
    this.settingsService.uploadOrgLogo(file).subscribe({
      next: (s) => {
        this.applySettings(s);
        this.uploadingLogo.set(false);
        input.value = '';
        this.snackBar.open('อัปโหลดโลโก้แล้ว', 'ปิด', { duration: 2000 });
      },
      error: () => {
        this.uploadingLogo.set(false);
        input.value = '';
        this.snackBar.open('อัปโหลดโลโก้ไม่สำเร็จ', 'ปิด', { duration: 3000 });
      },
    });
  }

  removeLogo(): void {
    this.uploadingLogo.set(true);
    this.settingsService.removeOrgLogo().subscribe({
      next: (s) => {
        this.applySettings(s);
        this.uploadingLogo.set(false);
      },
      error: () => this.uploadingLogo.set(false),
    });
  }

  saveOrg(): void {
    if (this.savingOrg()) return;
    this.savingOrg.set(true);
    this.settingsService.updateOrgSettings(this.orgForm.getRawValue()).subscribe({
      next: (s) => {
        this.applySettings(s);
        this.savingOrg.set(false);
        this.snackBar.open('บันทึกการตั้งค่าองค์กรแล้ว', 'ปิด', { duration: 2000 });
      },
      error: () => {
        this.savingOrg.set(false);
        this.snackBar.open('บันทึกไม่สำเร็จ', 'ปิด', { duration: 3000 });
      },
    });
  }

  saveSmtp(): void {
    if (this.savingSmtp()) return;
    const { smtpPass, ...rest } = this.smtpForm.getRawValue();
    this.savingSmtp.set(true);
    this.settingsService.updateOrgSettings({ ...rest, smtpPass: smtpPass || undefined }).subscribe({
      next: (s) => {
        this.applySettings(s);
        this.smtpForm.patchValue({ smtpPass: '' });
        this.savingSmtp.set(false);
        this.snackBar.open('บันทึกการตั้งค่า SMTP แล้ว', 'ปิด', { duration: 2000 });
      },
      error: () => {
        this.savingSmtp.set(false);
        this.snackBar.open('บันทึกการตั้งค่า SMTP ไม่สำเร็จ', 'ปิด', { duration: 3000 });
      },
    });
  }
}
