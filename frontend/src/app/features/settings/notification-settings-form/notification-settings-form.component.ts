import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SettingsService } from '../../../core/services/settings.service';
import { AuthService } from '../../../core/services/auth.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import type { INotificationSettings } from '../../../core/models/settings.model';

type ToggleKey =
  | 'emailEnabled'
  | 'telegramEnabled'
  | 'lineEnabled'
  | 'notifyNewTicket'
  | 'notifyAssign'
  | 'notifyStatusChange'
  | 'notifyComplete'
  | 'notifyCancel';

@Component({
  selector: 'khd-notification-settings-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatSlideToggleModule, MatFormFieldModule, MatInputModule, MatButtonModule, IconComponent],
  templateUrl: './notification-settings-form.component.html',
})
export class NotificationSettingsFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly settingsService = inject(SettingsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly authService = inject(AuthService);

  readonly canManage = computed(() => this.authService.hasPermission('settings:manage'));

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly savingCredentials = signal(false);
  readonly settings = signal<INotificationSettings | null>(null);

  readonly telegramForm = this.fb.nonNullable.group({
    telegramChatId: [''],
    telegramBotToken: [''],
  });
  readonly lineForm = this.fb.nonNullable.group({
    lineTargetId: [''],
    lineAccessToken: [''],
  });

  constructor() {
    this.settingsService.getNotificationSettings().subscribe((s) => {
      this.settings.set(s);
      this.telegramForm.patchValue({ telegramChatId: s.telegramChatId });
      this.lineForm.patchValue({ lineTargetId: s.lineTargetId });
      this.loading.set(false);
    });
  }

  toggle(key: ToggleKey): void {
    const current = this.settings();
    if (!current || this.saving()) return;

    const next = { ...current, [key]: !current[key] };
    this.settings.set(next);
    this.saving.set(true);
    this.settingsService.updateNotificationSettings({ [key]: next[key] }).subscribe({
      next: (updated) => {
        this.settings.set(updated);
        this.saving.set(false);
        this.snackBar.open('บันทึกการตั้งค่าแล้ว', 'ปิด', { duration: 2000 });
      },
      error: () => {
        this.settings.set(current);
        this.saving.set(false);
        this.snackBar.open('บันทึกการตั้งค่าไม่สำเร็จ', 'ปิด', { duration: 3000 });
      },
    });
  }

  saveTelegramCredentials(): void {
    if (this.savingCredentials()) return;
    const { telegramChatId, telegramBotToken } = this.telegramForm.getRawValue();
    this.savingCredentials.set(true);
    this.settingsService.updateNotificationSettings({ telegramChatId, telegramBotToken: telegramBotToken || undefined }).subscribe({
      next: (updated) => {
        this.settings.set(updated);
        this.telegramForm.patchValue({ telegramBotToken: '' });
        this.savingCredentials.set(false);
        this.snackBar.open('บันทึกการตั้งค่า Telegram แล้ว', 'ปิด', { duration: 2000 });
      },
      error: () => {
        this.savingCredentials.set(false);
        this.snackBar.open('บันทึกการตั้งค่า Telegram ไม่สำเร็จ', 'ปิด', { duration: 3000 });
      },
    });
  }

  saveLineCredentials(): void {
    if (this.savingCredentials()) return;
    const { lineTargetId, lineAccessToken } = this.lineForm.getRawValue();
    this.savingCredentials.set(true);
    this.settingsService.updateNotificationSettings({ lineTargetId, lineAccessToken: lineAccessToken || undefined }).subscribe({
      next: (updated) => {
        this.settings.set(updated);
        this.lineForm.patchValue({ lineAccessToken: '' });
        this.savingCredentials.set(false);
        this.snackBar.open('บันทึกการตั้งค่า LINE แล้ว', 'ปิด', { duration: 2000 });
      },
      error: () => {
        this.savingCredentials.set(false);
        this.snackBar.open('บันทึกการตั้งค่า LINE ไม่สำเร็จ', 'ปิด', { duration: 3000 });
      },
    });
  }
}
