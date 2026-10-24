import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'khd-notification-channels',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
    LoadingStateComponent,
    IconComponent,
  ],
  templateUrl: './notification-channels.component.html',
})
export class NotificationChannelsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly savedMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly alreadyConfigured = signal(false);

  readonly form = this.fb.nonNullable.group({
    telegramChatId: [''],
    lineUserId: [''],
  });

  constructor() {
    this.authService.getNotificationChannels().subscribe({
      next: (channels) => {
        this.form.patchValue({ telegramChatId: channels.telegramChatId ?? '', lineUserId: channels.lineUserId ?? '' });
        this.alreadyConfigured.set(!!(channels.telegramChatId || channels.lineUserId));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  submit(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.savedMessage.set(null);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    this.authService
      .updateNotificationChannels({
        telegramChatId: raw.telegramChatId.trim() || null,
        lineUserId: raw.lineUserId.trim() || null,
      })
      .subscribe({
        next: (channels) => {
          this.saving.set(false);
          this.savedMessage.set('บันทึกช่องทางการแจ้งเตือนสำเร็จ');
          this.alreadyConfigured.set(!!(channels.telegramChatId || channels.lineUserId));
        },
        error: () => {
          this.saving.set(false);
          this.errorMessage.set('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        },
      });
  }
}
