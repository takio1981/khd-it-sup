import { equipmentSyncService } from '@modules/equipment-sync/services/equipmentSync.service';

export function runScheduledEquipmentSync(): void {
  equipmentSyncService.startScheduledRun();
}
