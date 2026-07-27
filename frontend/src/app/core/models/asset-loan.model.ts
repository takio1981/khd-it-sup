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
}

export interface ICreateAssetLoanPayload {
  assetId: string;
  borrowerId: string;
  expectedReturnDate?: string;
  purpose?: string;
  conditionOnBorrow?: string;
}

export interface IAssetLoanStats {
  total: number;
  borrowed: number;
  overdue: number;
  returned: number;
}

export interface IAssetLoanChartData {
  topAssets: { label: string; count: number }[];
  topBorrowers: { label: string; count: number }[];
}
