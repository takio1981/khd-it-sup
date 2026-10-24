import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { BackupListComponent } from '../backup-list/backup-list.component';
import { BackupSettingsFormComponent } from '../backup-settings-form/backup-settings-form.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'khd-backup-settings-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatTabsModule, BackupListComponent, BackupSettingsFormComponent, PageHeaderComponent],
  templateUrl: './backup-settings-page.component.html',
})
export class BackupSettingsPageComponent {}
