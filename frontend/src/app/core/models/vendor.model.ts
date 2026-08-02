export interface IVendor {
  id: string;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type VendorRepairStatus =
  | 'QUOTATION_REQUESTED'
  | 'QUOTATION_RECEIVED'
  | 'APPROVED'
  | 'PO_GENERATED'
  | 'SENT'
  | 'IN_REPAIR'
  | 'RETURNED'
  | 'INSPECTED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface IVendorRepairOrder {
  id: string;
  ticketId: string;
  ticket: { id: string; ticketNumber: string; status: string };
  vendorId: string;
  vendor: { id: string; code: string; name: string; contactPerson: string | null; phone: string | null };
  quotationAmount: string | null;
  quotationFileUrl: string | null;
  poNumber: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  invoiceFileUrl: string | null;
  warrantyUntil: string | null;
  status: VendorRepairStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ICreateVendorPayload {
  code: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
}

export type IUpdateVendorPayload = Partial<Omit<ICreateVendorPayload, 'code'>> & { isActive?: boolean };

export interface ICreateVendorOrderPayload {
  ticketId: string;
  vendorId: string;
  quotationAmount?: number;
}

export interface IUpdateVendorOrderPayload {
  status?: VendorRepairStatus;
  vendorId?: string;
  quotationAmount?: number;
  poNumber?: string;
  sentAt?: string;
  receivedAt?: string;
  warrantyUntil?: string;
}
