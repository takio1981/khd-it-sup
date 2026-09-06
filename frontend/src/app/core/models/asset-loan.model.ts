export type AssetLoanStatus = 'BORROWED' | 'OVERDUE' | 'RETURNED';

export interface IAssetLoan {
  id: string;
  assetId: string;
  asset: { id: string; assetNumber: string; brand: string | null; model: string | null; category: { nameTh: string } };
  borrowerId: string;
  borrower: { id: string; fullName: string };
  recordedBy: string;
  recorder: { id: string; fullName: string };
  returnedBy: string | null;
  returner: { id: string; fullName: string } | null;
  borrowDate: string;
  expectedReturnDate: string | null;
  actualReturnDate: string | null;
  purpose: string | null;
  conditionOnBorrow: string | null;
  conditionOnReturn: string | null;
  status: AssetLoanStatus;
  takenToBuilding: { id: string; name: string } | null;
  takenToFloor: { id: string; name: string } | null;
  takenToRoom: { id: string; name: string } | null;
  takenToNote: string | null;
  currentHolder: { id: string; fullName: string } | null;
  currentBuilding: { id: string; name: string } | null;
  currentFloor: { id: string; name: string } | null;
  currentRoom: { id: string; name: string } | null;
  currentLocationNote: string | null;
  reminderCount: number;
  lastReminderAt: string | null;
}

export interface ICreateAssetLoanPayload {
  assetId: string;
  borrowerId: string;
  expectedReturnDate?: string;
  purpose?: string;
  conditionOnBorrow?: string;
  takenToBuildingId?: string;
  takenToFloorId?: string;
  takenToRoomId?: string;
  takenToNote?: string;
}

export interface IUpdateAssetLoanPayload {
  assetId?: string;
  borrowerId?: string;
  expectedReturnDate?: string;
  purpose?: string;
  conditionOnBorrow?: string;
  conditionOnReturn?: string;
}

export interface IAssetLoanStats {
  total: number;
  borrowed: number;
  overdue: number;
  returned: number;
  overdueReminded: number;
}

export interface ITransferAssetLoanPayload {
  newHolderId?: string;
  buildingId?: string;
  floorId?: string;
  roomId?: string;
  locationNote?: string;
  comment?: string;
}

export interface IAssetLoanChartData {
  topAssets: { label: string; count: number }[];
  topBorrowers: { label: string; count: number }[];
}
