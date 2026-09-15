import { backupService } from '@modules/backup/services/backup.service';

export async function runScheduledBackup(): Promise<void> {
  await backupService.runScheduled();
}
