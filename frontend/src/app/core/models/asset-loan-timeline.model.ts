export type AssetLoanTimelineEventType = 'BORROW' | 'TRANSFER' | 'REMINDER_SENT' | 'RETURN' | 'NOTE';

export interface IAssetLoanTimelineEvent {
  id: string;
  loanId: string;
  eventTime: string;
  eventType: AssetLoanTimelineEventType;
  holder: { id: string; fullName: string } | null;
  building: { id: string; name: string } | null;
  floor: { id: string; name: string } | null;
  room: { id: string; name: string } | null;
  locationNote: string | null;
  responsible: { id: string; fullName: string } | null;
  comment: string | null;
}
