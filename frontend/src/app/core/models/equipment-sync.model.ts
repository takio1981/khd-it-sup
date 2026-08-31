export type EquipmentSyncTrigger = 'MANUAL' | 'SCHEDULER';

export interface IEquipmentSyncSummary {
  trigger: EquipmentSyncTrigger;
  startedAt: string;
  finishedAt: string;
  totalFetched: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  failedPages: number[];
  unmatchedDepartments: { locationName: string; count: number }[];
  sampleErrors: { govAssetNumber: string; message: string }[];
  aborted: boolean;
  abortReason?: string;
}

export interface IEquipmentSyncStatus {
  isRunning: boolean;
  currentTrigger: EquipmentSyncTrigger | null;
  startedAt: string | null;
  lastRun: IEquipmentSyncSummary | null;
}
