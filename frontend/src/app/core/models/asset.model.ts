export interface IAssetCategory {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  icon: string | null;
  requiresSerial: boolean;
}

export type AssetStatus =
  | 'ACTIVE'
  | 'IN_REPAIR'
  | 'WAITING_PARTS'
  | 'MAINTENANCE'
  | 'RESERVED'
  | 'INACTIVE'
  | 'DISPOSED'
  | 'LOST';

export type AssetAcquisitionType = 'PURCHASE' | 'LEASE_TO_OWN' | 'LEASE_USE' | 'DONATED' | 'BORROWED' | 'UNKNOWN';

export interface IAssetPhoto {
  id: string;
  fileUrl: string;
  caption: string | null;
  uploadedAt: string;
}

export interface IAsset {
  id: string;
  assetNumber: string;
  govAssetNumber: string | null;
  serialNumber: string | null;
  model: string | null;
  brand: string | null;
  categoryId: string;
  category: { id: string; code: string; nameTh: string; icon: string | null };
  department: { id: string; nameTh: string } | null;
  building: { id: string; name: string } | null;
  floor: { id: string; name: string } | null;
  room: { id: string; name: string } | null;
  owner: { id: string; fullName: string; username: string } | null;
  purchaseDate: string | null;
  warrantyExpireDate: string | null;
  price: string | null;
  photoUrl: string | null;
  status: AssetStatus;
  acquisitionType: AssetAcquisitionType;
  unitType: string | null;
  budgetYear: string | null;
  equipClassificationCode: string | null;
  equipClassificationName: string | null;
  externalSource: string | null;
  externalId: string | null;
  remark: string | null;
  createdAt: string;
  qrcode: { id: string; qrToken: string; shortCode: string | null; isActive: boolean } | null;
  photos?: IAssetPhoto[];
}

export interface IAssetHistoryItem {
  id: string;
  ticketNumber: string;
  status: string;
  urgency: string;
  description: string;
  createdAt: string;
  closedAt: string | null;
  assignedTechnician: { id: string; fullName: string } | null;
}

export interface ICreateAssetPayload {
  categoryId: string;
  govAssetNumber?: string;
  serialNumber?: string;
  model?: string;
  brand?: string;
  departmentId?: string;
  buildingId?: string;
  floorId?: string;
  roomId?: string;
  locationNote?: string;
  price?: number;
  ownerUserId?: string;
  acquisitionType?: AssetAcquisitionType;
  unitType?: string;
  budgetYear?: string;
  remark?: string;
  status?: AssetStatus;
}

export interface ICreateAssetCategoryPayload {
  code: string;
  nameTh: string;
  nameEn: string;
  icon?: string;
  requiresSerial?: boolean;
}
