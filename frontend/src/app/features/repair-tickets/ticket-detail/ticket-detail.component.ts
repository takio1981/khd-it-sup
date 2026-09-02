import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, ViewChild, ElementRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RepairTicketService } from '../../../core/services/repair-ticket.service';
import { AuthService } from '../../../core/services/auth.service';
import { SparePartService } from '../../../core/services/spare-part.service';
import { VendorService } from '../../../core/services/vendor.service';
import { VendorRepairOrderService } from '../../../core/services/vendor-repair-order.service';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { TimelineComponent } from '../../../shared/components/timeline/timeline.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { TicketPrintPreviewComponent } from '../../../shared/components/ticket-print-preview/ticket-print-preview.component';
import { AttachmentThumbnailComponent } from '../../../shared/components/attachment-thumbnail/attachment-thumbnail.component';
import { AssetPhotoThumbnailComponent } from '../../../shared/components/asset-photo-thumbnail/asset-photo-thumbnail.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { EQUIPMENT_TYPE_LABEL_TH, INSPECTION_OUTCOME_LABEL_TH, URGENCY_LABEL_TH } from '../../../core/constants/status.const';
import { getCategoryIconName } from '../../../core/utils/category-icon.util';
import {
  CancelTicketDialogComponent,
  AssignTechnicianDialogComponent,
  RepairSummaryDialogComponent,
  InspectionDialogComponent,
  IssuePartDialogComponent,
  AcceptTicketDialogComponent,
  type IIssuePartDialogResult,
  type IAcceptTicketDialogResult,
} from './ticket-dialogs';
import type { IRepairSummaryPayload } from '../../../core/services/repair-ticket.service';
import type { IInspectionPayload, IRepairTicketDetail, ITimelineEvent } from '../../../core/models/repair-ticket.model';
import type { ISparePartTransaction } from '../../../core/models/spare-part.model';
import type { IVendor, IVendorRepairOrder, VendorRepairStatus } from '../../../core/models/vendor.model';

const VENDOR_ORDER_STATUSES: VendorRepairStatus[] = [
  'QUOTATION_REQUESTED',
  'QUOTATION_RECEIVED',
  'APPROVED',
  'PO_GENERATED',
  'SENT',
  'IN_REPAIR',
  'RETURNED',
  'INSPECTED',
  'COMPLETED',
  'CANCELLED',
];

const VENDOR_ORDER_STATUS_LABEL_TH: Record<string, string> = {
  QUOTATION_REQUESTED: 'ขอใบเสนอราคา',
  QUOTATION_RECEIVED: 'ได้รับใบเสนอราคาแล้ว',
  APPROVED: 'อนุมัติแล้ว',
  PO_GENERATED: 'ออกเลขที่ใบสั่งซ่อมแล้ว',
  SENT: 'ส่งเครื่องแล้ว',
  IN_REPAIR: 'กำลังซ่อมที่ร้าน',
  RETURNED: 'รับเครื่องคืนแล้ว',
  INSPECTED: 'ตรวจสอบหลังซ่อมแล้ว',
  COMPLETED: 'เสร็จสิ้น',
  CANCELLED: 'ยกเลิก',
};

@Component({
  selector: 'khd-ticket-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    StatusBadgeComponent,
    TimelineComponent,
    IconComponent,
    AttachmentThumbnailComponent,
    AssetPhotoThumbnailComponent,
    HasPermissionDirective,
  ],
  templateUrl: './ticket-detail.component.html',
})
export class TicketDetailComponent {
  private readonly repairTicketService = inject(RepairTicketService);
  private readonly authService = inject(AuthService);
  private readonly sparePartService = inject(SparePartService);
  private readonly vendorService = inject(VendorService);
  private readonly vendorRepairOrderService = inject(VendorRepairOrderService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly partsUsed = signal<ISparePartTransaction[]>([]);

  readonly vendorOrder = signal<IVendorRepairOrder | null>(null);
  readonly vendors = signal<IVendor[]>([]);
  readonly showCreateVendorOrder = signal(false);
  readonly savingVendorOrder = signal(false);
  readonly vendorOrderStatuses = VENDOR_ORDER_STATUSES;
  readonly vendorOrderStatusLabels = VENDOR_ORDER_STATUS_LABEL_TH;
  selectedVendorOrderStatus: VendorRepairStatus | '' = '';
  newVendorId = '';
  newQuotationAmount: number | null = null;

  private static readonly MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
  private static readonly MAX_ATTACHMENT_COUNT = 5;
  private static readonly ALLOWED_ATTACHMENT_PREFIXES = ['image/', 'video/'];

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  /** ผูกอัตโนมัติจาก route param :id */
  readonly id = input<string>('');

  readonly ticket = signal<IRepairTicketDetail | null>(null);
  readonly timeline = signal<ITimelineEvent[]>([]);
  readonly loading = signal(true);
  readonly acting = signal(false);
  readonly commentText = signal('');
  readonly urgencyLabels = URGENCY_LABEL_TH;
  readonly equipmentTypeLabels = EQUIPMENT_TYPE_LABEL_TH;
  readonly outcomeLabels = INSPECTION_OUTCOME_LABEL_TH;

  readonly availableTransitions = computed(() => {
    const t = this.ticket();
    if (!t?.workflowInstance) return [];
    const currentStepId = t.workflowInstance.currentStep.id;
    return t.workflowInstance.template.transitions
      .filter((tr) => tr.fromStepId === currentStepId)
      .map((tr) => {
        const toStep = t.workflowInstance!.template.steps.find((s) => s.id === tr.toStepId);
        return { toStep, conditionKey: tr.conditionKey, label: tr.label };
      })
      .filter((x): x is { toStep: NonNullable<typeof x.toStep>; conditionKey: string | null; label: string | null } => !!x.toStep)
      .filter((x) => x.toStep.stepCode !== 'CLOSED' && x.toStep.stepCode !== 'CANCELLED');
  });

  readonly canReceive = computed(() => this.ticket()?.status === 'SUBMITTED');
  readonly canClose = computed(() => this.ticket()?.status === 'USER_ACCEPTANCE');
  readonly hasFullClosePermission = computed(() => this.authService.hasAnyPermission(['ticket:close']));
  readonly isOwnTicketReporter = computed(
    () => !!this.ticket() && this.ticket()!.reportedBy.id === this.authService.currentUser()?.id,
  );

  readonly hasFullApprovePermission = computed(() => this.authService.hasAnyPermission(['ticket:approve']));
  /** หัวหน้างาน/กลุ่มงานลงนามได้เฉพาะใบแจ้งซ่อมของหน่วยงานตนเอง (ต้องตั้งค่า isUnitHead ไว้ในข้อมูลผู้ใช้งานด้วย) */
  readonly isUnitHeadOfTicketDept = computed(() => {
    const user = this.authService.currentUser();
    return !!user?.isUnitHead && !!this.ticket()?.department && user.departmentId === this.ticket()!.department!.id;
  });
  readonly canShowApproveUnitHead = computed(() => this.hasFullApprovePermission() || this.isUnitHeadOfTicketDept());
  readonly canApproveUnitHead = computed(() => !!this.ticket() && !this.ticket()!.unitHeadApprovedAt);
  readonly canApproveDigitalHealthHead = computed(
    () => !!this.ticket() && !!this.ticket()!.inspectedAt && !this.ticket()!.digitalHealthHeadApprovedAt,
  );

  constructor() {
    // ใช้ effect() แทนการเรียก load() ตรง ๆ เพราะ withComponentInputBinding() ผูกค่า id
    // เข้ากับ route param "หลัง" constructor ทำงาน ไม่ใช่ระหว่างนั้น — ต้อง react ต่อการเปลี่ยนแปลงของ id()
    effect(() => {
      if (this.id()) this.load();
    });
  }

  /** ไม่มีรูปภาพครุภัณฑ์บันทึกไว้ — ใช้ icon ของประเภทครุภัณฑ์นั้นแทน */
  assetCategoryIconName(category: { icon: string | null } | null): string {
    return getCategoryIconName(category?.icon);
  }

  private load(): void {
    const id = this.id();
    if (!id) return;
    this.loading.set(true);
    this.repairTicketService.getById(id).subscribe((ticket) => {
      this.ticket.set(ticket);
      this.loading.set(false);
    });
    this.repairTicketService.getTimeline(id).subscribe((events) => this.timeline.set(events));
    this.sparePartService.listTransactions({ ticketId: id, limit: 50 }).subscribe((res) => this.partsUsed.set(res.items));
    this.vendorRepairOrderService.list({ ticketId: id, limit: 1 }).subscribe((res) => {
      const order = res.items[0] ?? null;
      this.vendorOrder.set(order);
      this.selectedVendorOrderStatus = order?.status ?? '';
    });
  }

  private refresh(): void {
    this.acting.set(false);
    this.load();
  }

  receive(): void {
    this.acting.set(true);
    this.repairTicketService.receive(this.id()).subscribe({ next: () => this.refresh(), error: () => this.acting.set(false) });
  }

  transition(toStepCode: string, conditionKey: string | null): void {
    if (toStepCode === 'COMPLETED') {
      this.openRepairSummaryDialog(toStepCode, conditionKey);
      return;
    }
    this.acting.set(true);
    this.repairTicketService
      .transition(this.id(), toStepCode, conditionKey ?? undefined)
      .subscribe({ next: () => this.refresh(), error: () => this.acting.set(false) });
  }

  private openRepairSummaryDialog(toStepCode: string, conditionKey: string | null): void {
    const ref = this.dialog.open(RepairSummaryDialogComponent, { width: '520px', data: { mode: 'complete' } });
    ref.afterClosed().subscribe((repairSummary: IRepairSummaryPayload | undefined) => {
      if (!repairSummary) return;
      this.acting.set(true);
      this.repairTicketService
        .transition(this.id(), toStepCode, conditionKey ?? undefined, undefined, repairSummary)
        .subscribe({ next: () => this.refresh(), error: () => this.acting.set(false) });
    });
  }

  openEditRepairSummary(): void {
    const t = this.ticket();
    if (!t) return;
    const ref = this.dialog.open(RepairSummaryDialogComponent, {
      width: '520px',
      data: {
        mode: 'edit',
        initial: { rootCause: t.rootCause, repairAction: t.repairAction, partsUsed: t.partsUsed, recommendation: t.recommendation },
      },
    });
    ref.afterClosed().subscribe((repairSummary: IRepairSummaryPayload | undefined) => {
      if (!repairSummary) return;
      this.acting.set(true);
      this.repairTicketService.updateRepairSummary(this.id(), repairSummary).subscribe({
        next: () => this.refresh(),
        error: () => this.acting.set(false),
      });
    });
  }

  openAcceptDialog(): void {
    const requireSignature = !this.hasFullClosePermission();
    const ref = this.dialog.open(AcceptTicketDialogComponent, { width: '420px', data: { requireSignature } });
    ref.afterClosed().subscribe((result: IAcceptTicketDialogResult | undefined) => {
      if (!result) return;
      this.acting.set(true);
      this.repairTicketService
        .close(this.id(), result.acceptorSignature)
        .subscribe({ next: () => this.refresh(), error: () => this.acting.set(false) });
    });
  }

  approveUnitHead(): void {
    this.acting.set(true);
    this.repairTicketService.approveUnitHead(this.id()).subscribe({ next: () => this.refresh(), error: () => this.acting.set(false) });
  }

  openInspectionDialog(): void {
    const ref = this.dialog.open(InspectionDialogComponent, { width: '480px' });
    ref.afterClosed().subscribe((payload: IInspectionPayload | undefined) => {
      if (!payload) return;
      this.acting.set(true);
      this.repairTicketService.recordInspection(this.id(), payload).subscribe({ next: () => this.refresh(), error: () => this.acting.set(false) });
    });
  }

  approveDigitalHealthHead(): void {
    this.acting.set(true);
    this.repairTicketService
      .approveDigitalHealthHead(this.id())
      .subscribe({ next: () => this.refresh(), error: () => this.acting.set(false) });
  }

  openPrintPreview(): void {
    const t = this.ticket();
    if (!t) return;
    this.dialog.open(TicketPrintPreviewComponent, { width: '900px', maxWidth: '95vw', data: { ticket: t } });
  }

  openAssignDialog(): void {
    const ref = this.dialog.open(AssignTechnicianDialogComponent, { width: '420px' });
    ref.afterClosed().subscribe((technicianId: string | undefined) => {
      if (!technicianId) return;
      this.acting.set(true);
      this.repairTicketService.assign(this.id(), technicianId).subscribe({ next: () => this.refresh(), error: () => this.acting.set(false) });
    });
  }

  openIssuePartDialog(): void {
    this.sparePartService.list({ limit: 200 }).subscribe((res) => {
      const ref = this.dialog.open(IssuePartDialogComponent, { width: '420px', data: { parts: res.items } });
      ref.afterClosed().subscribe((result: IIssuePartDialogResult | undefined) => {
        if (!result) return;
        this.sparePartService
          .recordTransaction(result.sparePartId, { type: 'ISSUE', quantity: result.quantity, ticketId: this.id(), note: result.note || undefined })
          .subscribe({
            next: () => {
              this.snackBar.open('เบิกอะไหล่แล้ว', 'ปิด', { duration: 2000 });
              this.load();
            },
            error: (err) => {
              const message = err?.error?.error?.message ?? 'เบิกอะไหล่ไม่สำเร็จ';
              this.snackBar.open(message, 'ปิด', { duration: 3000 });
            },
          });
      });
    });
  }

  openCreateVendorOrderForm(): void {
    this.vendorService.list({ limit: 100, activeOnly: true }).subscribe((res) => this.vendors.set(res.items));
    this.newVendorId = '';
    this.newQuotationAmount = null;
    this.showCreateVendorOrder.set(true);
  }

  cancelCreateVendorOrder(): void {
    this.showCreateVendorOrder.set(false);
  }

  createVendorOrder(): void {
    if (!this.newVendorId || this.savingVendorOrder()) return;
    this.savingVendorOrder.set(true);
    this.vendorRepairOrderService
      .create({ ticketId: this.id(), vendorId: this.newVendorId, quotationAmount: this.newQuotationAmount ?? undefined })
      .subscribe({
        next: (order) => {
          this.vendorOrder.set(order);
          this.selectedVendorOrderStatus = order.status;
          this.showCreateVendorOrder.set(false);
          this.savingVendorOrder.set(false);
          this.snackBar.open('สร้างใบส่งซ่อมภายนอกแล้ว', 'ปิด', { duration: 2000 });
        },
        error: () => {
          this.savingVendorOrder.set(false);
          this.snackBar.open('สร้างใบส่งซ่อมภายนอกไม่สำเร็จ', 'ปิด', { duration: 3000 });
        },
      });
  }

  updateVendorOrderStatus(): void {
    const order = this.vendorOrder();
    if (!order || !this.selectedVendorOrderStatus || this.savingVendorOrder()) return;
    this.savingVendorOrder.set(true);
    this.vendorRepairOrderService.update(order.id, { status: this.selectedVendorOrderStatus }).subscribe({
      next: (updated) => {
        this.vendorOrder.set(updated);
        this.savingVendorOrder.set(false);
        this.snackBar.open('อัปเดตสถานะใบส่งซ่อมภายนอกแล้ว', 'ปิด', { duration: 2000 });
        if (updated.status === 'RETURNED') this.load();
      },
      error: () => {
        this.savingVendorOrder.set(false);
        this.snackBar.open('อัปเดตสถานะไม่สำเร็จ', 'ปิด', { duration: 3000 });
      },
    });
  }

  onQuotationFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const order = this.vendorOrder();
    if (!file || !order) return;
    this.vendorRepairOrderService.uploadQuotationFile(order.id, file).subscribe((updated) => {
      this.vendorOrder.set(updated);
      input.value = '';
    });
  }

  onInvoiceFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const order = this.vendorOrder();
    if (!file || !order) return;
    this.vendorRepairOrderService.uploadInvoiceFile(order.id, file).subscribe((updated) => {
      this.vendorOrder.set(updated);
      input.value = '';
    });
  }

  viewVendorFile(fileUrl: string): void {
    this.repairTicketService.getAttachmentBlob(fileUrl).subscribe((blob) => {
      window.open(URL.createObjectURL(blob), '_blank');
    });
  }

  openCancelDialog(): void {
    const ref = this.dialog.open(CancelTicketDialogComponent, { width: '420px' });
    ref.afterClosed().subscribe((reason: string | undefined) => {
      if (!reason) return;
      this.acting.set(true);
      this.repairTicketService.cancel(this.id(), reason).subscribe({ next: () => this.refresh(), error: () => this.acting.set(false) });
    });
  }

  submitComment(): void {
    const comment = this.commentText().trim();
    if (!comment) return;
    this.repairTicketService.addComment(this.id(), comment).subscribe(() => {
      this.commentText.set('');
      this.repairTicketService.getTimeline(this.id()).subscribe((events) => this.timeline.set(events));
    });
  }

  triggerFileInput(): void {
    this.fileInput?.nativeElement.click();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) return;

    const fileList = Array.from(files);
    if (fileList.length > TicketDetailComponent.MAX_ATTACHMENT_COUNT) {
      this.snackBar.open(`แนบไฟล์ได้สูงสุด ${TicketDetailComponent.MAX_ATTACHMENT_COUNT} ไฟล์ต่อครั้ง`, 'ปิด', { duration: 4000 });
      input.value = '';
      return;
    }

    const invalidType = fileList.find(
      (f) => !TicketDetailComponent.ALLOWED_ATTACHMENT_PREFIXES.some((prefix) => f.type.startsWith(prefix)),
    );
    if (invalidType) {
      this.snackBar.open(`แนบได้เฉพาะไฟล์รูปภาพหรือวิดีโอเท่านั้น (${invalidType.name})`, 'ปิด', { duration: 4000 });
      input.value = '';
      return;
    }

    const tooLarge = fileList.find((f) => f.size > TicketDetailComponent.MAX_ATTACHMENT_SIZE_BYTES);
    if (tooLarge) {
      this.snackBar.open(`ไฟล์ "${tooLarge.name}" มีขนาดเกิน 5 MB`, 'ปิด', { duration: 4000 });
      input.value = '';
      return;
    }

    this.repairTicketService.uploadAttachments(this.id(), fileList).subscribe({
      next: () => {
        this.repairTicketService.getById(this.id()).subscribe((ticket) => this.ticket.set(ticket));
        this.repairTicketService.getTimeline(this.id()).subscribe((events) => this.timeline.set(events));
        input.value = '';
      },
      error: () => {
        this.snackBar.open('แนบไฟล์ไม่สำเร็จ', 'ปิด', { duration: 3000 });
        input.value = '';
      },
    });
  }
}
