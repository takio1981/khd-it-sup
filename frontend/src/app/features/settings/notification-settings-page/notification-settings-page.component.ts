import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { NotificationSettingsFormComponent } from '../notification-settings-form/notification-settings-form.component';
import { NotificationLogListComponent } from '../notification-log-list/notification-log-list.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'khd-notification-settings-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatTabsModule, NotificationSettingsFormComponent, NotificationLogListComponent, PageHeaderComponent],
  templateUrl: './notification-settings-page.component.html',
})
export class NotificationSettingsPageComponent {}
