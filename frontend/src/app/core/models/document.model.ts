export interface IDocumentTemplate {
  id: string;
  code: string;
  nameTh: string;
  description: string | null;
  isActive: boolean;
}

export interface IGeneratedDocument {
  id: string;
  ticketId: string | null;
  ticket: { id: string; ticketNumber: string } | null;
  templateCode: string;
  runningNumber: string;
  fileUrl: string;
  generatedBy: string | null;
  generatedAt: string;
}
