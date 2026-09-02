export type TicketUrgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type EquipmentType = 'COMPUTER_CASE' | 'NOTEBOOK' | 'PRINTER' | 'SCANNER' | 'MONITOR' | 'OTHER';
export type InspectionOutcome = 'IN_HOUSE' | 'SEND_EXTERNAL' | 'REPLACE_NEW';

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
  reportedBy: { id: string; fullName: string; username: string; position?: { nameTh: string } | null };
  department: { id: string; nameTh: string } | null;
  assignedTechnician: { id: string; fullName: string; username: string } | null;
  workflowInstance: { id: string; currentStep: { stepCode: string; stepNameTh: string; colorCode: string | null } } | null;
  /** แอดมิน/ช่างคนแรกที่เข้ามาดูรายละเอียด — null = ยังไม่มีใครดู (แสดงสัญลักษณ์งานใหม่กระพริบ) */
  firstViewedBy: { id: string; fullName: string } | null;
  firstViewedAt: string | null;
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
  summarySignature: string | null;
}

export interface IRepairTicketDetail extends IRepairTicketListItem, IRepairSummary {
  problemType: string | null;
  locationNote: string | null;
  contactPhone: string | null;
  /** override asset ของ IRepairTicketListItem — เพิ่ม category.icon + photos สำหรับแสดงรูปครุภัณฑ์ (หรือ icon สำรอง) ในหน้ารายละเอียด */
  asset: {
    id: string;
    assetNumber: string;
    model: string | null;
    brand: string | null;
    govAssetNumber: string | null;
    serialNumber: string | null;
    category: { nameTh: string; icon: string | null } | null;
    photos: { id: string; fileUrl: string }[];
  } | null;
  attachments: { id: string; fileUrl: string; fileType: string | null; uploadedAt: string }[];
  progress: { currentStepCode: string | null; currentStepNameTh: string | null; progressPercent: number };
  workflowInstance:
    | {
        id: string;
        currentStep: IWorkflowStep;
        template: { steps: IWorkflowStep[]; transitions: IWorkflowTransition[] };
      }
    | null;

  // ส่วนที่ 1 ของแบบฟอร์มกระดาษ — ข้อมูลอุปกรณ์/อุปกรณ์เสริมที่ผู้แจ้งซ่อมกรอกตอนแจ้ง
  equipmentType: EquipmentType | null;
  equipmentTypeOther: string | null;
  deviceColor: string | null;
  hasAdapterCable: boolean;
  hasVgaCable: boolean;
  hasPowerCable: boolean;
  hasOtherAccessory: boolean;
  otherAccessoryNote: string | null;

  // ส่วนที่ 1 — ลงนามหัวหน้างาน/กลุ่มงานของผู้แจ้งซ่อม
  unitHeadApprovedAt: string | null;
  unitHeadApprovedBy: { id: string; fullName: string } | null;

  // ส่วนที่ 2 — ผลตรวจสอบเบื้องต้นโดยเจ้าหน้าที่ไอที
  inspectedAt: string | null;
  inspectedBy: { id: string; fullName: string } | null;
  inspectionOutcome: InspectionOutcome | null;
  requestPartsNeeded: boolean;
  requestedPart1Name: string | null;
  requestedPart1Qty: number | null;
  requestedPart2Name: string | null;
  requestedPart2Qty: number | null;
  requestedPart3Name: string | null;
  requestedPart3Qty: number | null;
  sendExternalReason: string | null;

  // ส่วนที่ 2 — ลงนามหัวหน้ากลุ่มงานสุขภาพดิจิทัล
  digitalHealthHeadApprovedAt: string | null;
  digitalHealthHeadApprovedBy: { id: string; fullName: string } | null;

  // เซ็นรับงานคืน (ผู้ตรวจรับงาน) — ผู้แจ้งซ่อมเซ็นเองตอนสถานะ "ผู้แจ้งรับมอบ"
  acceptedBy: { id: string; fullName: string } | null;
  acceptorSignature: string | null;
}

export interface ITimelineAttachment {
  fileUrl: string;
  fileType: string | null;
}

export interface ITimelineEvent {
  id: string;
  eventTime: string;
  eventType: string;
  previousStatus: string | null;
  currentStatus: string;
  comment: string | null;
  attachmentUrl: string | null;
  /** ไฟล์แนบทั้งหมดของ event นี้ — event เก่าก่อนมีฟิลด์นี้จะเป็น null ให้ fallback ไปใช้ attachmentUrl แทน */
  attachmentUrls: ITimelineAttachment[] | null;
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
  equipmentType?: EquipmentType;
  equipmentTypeOther?: string;
  deviceColor?: string;
  hasAdapterCable?: boolean;
  hasVgaCable?: boolean;
  hasPowerCable?: boolean;
  hasOtherAccessory?: boolean;
  otherAccessoryNote?: string;
}

export interface IInspectionPayload {
  inspectionOutcome: InspectionOutcome;
  requestPartsNeeded?: boolean;
  requestedPart1Name?: string;
  requestedPart1Qty?: number;
  requestedPart2Name?: string;
  requestedPart2Qty?: number;
  requestedPart3Name?: string;
  requestedPart3Qty?: number;
  sendExternalReason?: string;
}
