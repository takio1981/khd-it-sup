export interface ISparePart {
  id: string;
  code: string;
  name: string;
  unit: string;
  quantityOnHand: number;
  reorderLevel: number;
  unitCost: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SparePartTxnType = 'RESERVE' | 'ISSUE' | 'RETURN' | 'ADJUST' | 'PURCHASE' | 'RECEIVE';

export interface ISparePartTransaction {
  id: string;
  sparePartId: string;
  sparePart: { id: string; code: string; name: string; unit: string };
  ticketId: string | null;
  ticket: { id: string; ticketNumber: string } | null;
  type: SparePartTxnType;
  quantity: number;
  balanceAfter: number;
  performedBy: string | null;
  note: string | null;
  createdAt: string;
}

export interface ICreateSparePartPayload {
  code: string;
  name: string;
  unit?: string;
  reorderLevel?: number;
  unitCost?: number;
}

export type IUpdateSparePartPayload = Partial<Omit<ICreateSparePartPayload, 'code'>>;

export interface IRecordTransactionPayload {
  type: SparePartTxnType;
  quantity: number;
  ticketId?: string;
  note?: string;
}
