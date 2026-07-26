export type TicketUrgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface IRepairTicketListItem {
  id: string;
  ticketNumber: string;
  status: string;
  urgency: TicketUrgency;
  description: string;
  createdAt: string;
  closedAt: string | null;
  asset: {
    id: string;
    assetNumber: string;
    model: string | null;
    brand: string | null;
    govAssetNumber: string | null;
    serialNumber: string | null;
    category: { nameTh: string } | null;
  } | null;
  reportedBy: { id: string; fullName: string; username: string };
  department: { id: string; nameTh: string } | null;
  assignedTechnician: { id: string; fullName: string; username: string } | null;
  workflowInstance: { id: string; currentStep: { stepCode: string; stepNameTh: string; colorCode: string | null } } | null;
}

export interface IWorkflowStep {
  id: string;
  stepCode: string;
  stepNameTh: string;
  stepOrder: number;
  colorCode: string | null;
  isTerminal: boolean;
}

export interface IWorkflowTransition {
  id: string;
  fromStepId: string | null;
  toStepId: string;
  conditionKey: string | null;
  label: string | null;
}

export interface IRepairSummary {
  rootCause: string | null;
  repairAction: string | null;
  partsUsed: string | null;
  recommendation: string | null;
  summaryAt: string | null;
  summaryByUser: { id: string; fullName: string } | null;
}

export interface IRepairTicketDetail extends IRepairTicketListItem, IRepairSummary {
  problemType: string | null;
  locationNote: string | null;
  contactPhone: string | null;
  attachments: { id: string; fileUrl: string; fileType: string | null; uploadedAt: string }[];
  progress: { currentStepCode: string | null; currentStepNameTh: string | null; progressPercent: number };
  workflowInstance:
    | {
        id: string;
        currentStep: IWorkflowStep;
        template: { steps: IWorkflowStep[]; transitions: IWorkflowTransition[] };
      }
    | null;
}

export interface ITimelineEvent {
  id: string;
  eventTime: string;
  eventType: string;
  previousStatus: string | null;
  currentStatus: string;
  comment: string | null;
  attachmentUrl: string | null;
  approvalResult: string | null;
  elapsedSeconds: number | null;
  slaRemainingSeconds: number | null;
  responsible: { id: string; fullName: string; username: string } | null;
  department: { nameTh: string } | null;
}

export interface ICreateTicketPayload {
  assetId?: string;
  problemType?: string;
  description: string;
  urgency: TicketUrgency;
  locationNote?: string;
  contactPhone?: string;
  departmentId?: string;
}
