import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BackupService } from '../../../core/services/backup.service';
import { AuthService } from '../../../core/services/auth.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { BackupTablePickerComponent } from '../backup-table-picker/backup-table-picker.component';
import type { BackupScope, IBackupSettings, IBackupTableGroup } from '../../../core/models/backup.model';

@Component({
  selector: 'khd-backup-settings-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatSlideToggleModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    IconComponent,
    BackupTablePickerComponent,
  ],
  templateUrl: './backup-settings-form.component.html',
})
export class BackupSettingsFormComponent {
  private readonly backupService = inject(BackupService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly authService = inject(AuthService);

  readonly canManage = computed(() => this.authService.hasPermission('backup:manage'));

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly settings = signal<IBackupSettings | null>(null);
  readonly tableGroups = signal<IBackupTableGroup[]>([]);

  retentionDaysInput = 30;

  constructor() {
    this.backupService.getTables().subscribe((groups) => this.tableGroups.set(groups));
    this.backupService.getSettings().subscribe((s) => {
      this.settings.set(s);
      this.retentionDaysInput = s.retentionDays;
      this.loading.set(false);
    });
  }

  toggleEnabled(): void {
    const current = this.settings();
    if (!current || this.saving()) return;
    this.save({ enabled: !current.enabled });
  }

  onScopeChange(scope: BackupScope): void {
    this.save({ scope });
  }

  onTablesChange(includedTables: string[]): void {
    this.save({ includedTables });
  }

  saveRetentionDays(): void {
    const days = Math.max(1, Math.min(365, Math.round(this.retentionDaysInput) || 30));
    this.retentionDaysInput = days;
    this.save({ retentionDays: days });
  }

  private save(patch: Partial<IBackupSettings>): void {
    const current = this.settings();
    if (!current) return;
    const next = { ...current, ...patch };
    this.settings.set(next);
    this.saving.set(true);
    this.backupService.updateSettings(patch).subscribe({
      next: (updated) => {
        this.settings.set(updated);
        this.retentionDaysInput = updated.retentionDays;
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
}
