import { ChangeDetectionStrategy, Component, ElementRef, Injector, ViewChild, afterNextRender, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog } from '@angular/material/dialog';
import { RepairTicketService } from '../../../core/services/repair-ticket.service';
import { AuthService } from '../../../core/services/auth.service';
import { SparePartService } from '../../../core/services/spare-part.service';
import { VendorService } from '../../../core/services/vendor.service';
import { VendorRepairOrderService } from '../../../core/services/vendor-repair-order.service';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { TimelineComponent } from '../../../shared/components/timeline/timeline.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { TicketPrintPreviewComponent } from '../../../shared/components/ticket-print-preview/ticket-print-preview.component';
import { TicketPrintPreviewGeneralComponent } from '../../../shared/components/ticket-print-preview-general/ticket-print-preview-general.component';
import { AttachmentThumbnailComponent } from '../../../shared/components/attachment-thumbnail/attachment-thumbnail.component';
import { AssetPhotoThumbnailComponent } from '../../../shared/components/asset-photo-thumbnail/asset-photo-thumbnail.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { EQUIPMENT_TYPE_LABEL_TH, INSPECTION_OUTCOME_LABEL_TH, URGENCY_COLOR, URGENCY_LABEL_TH } from '../../../core/constants/status.const';
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
import { KhdNumberPipe } from '../../../shared/pipes/khd-number.pipe';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';
import { KhdDatePipe } from '../../../shared/pipes/khd-date.pipe';

const BRANCH_STEP_CODES = new Set(['WAITING_PARTS', 'VENDOR_REPAIR', 'WAITING_APPROVAL']);

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
    FormsModule,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    StatusBadgeComponent,
    TimelineComponent,
    IconComponent,
    AttachmentThumbnailComponent,
    AssetPhotoThumbnailComponent,
    HasPermissionDirective,
    KhdNumberPipe,
    LoadingStateComponent,
    KhdDatePipe,
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
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

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
  @ViewChild('trailScroller') trailScroller?: ElementRef<HTMLElement>;

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
  /** ยกเลิกได้เฉพาะสถานะที่มี transition ไป CANCELLED จริงตาม workflow เท่านั้น (data-driven ไม่ hardcode
   * รายชื่อสถานะเอง เพราะใบเก่าที่ค้างอยู่ใน workflow เวอร์ชันก่อนหน้าอาจมีกติกายกเลิกต่างจากใบใหม่) — ป้องกัน
   * ปุ่ม "ยกเลิกงาน" โชว์ตลอดแม้กดแล้วจะโดน backend ปฏิเสธเสมอ (ผู้ใช้ไม่รู้เหตุผลว่าทำไมยกเลิกไม่ได้) */
  readonly canCancel = computed(() => {
    const t = this.ticket();
    if (!t?.workflowInstance) return false;
    const currentStepId = t.workflowInstance.currentStep.id;
    const cancelledStep = t.workflowInstance.template.steps.find((s) => s.stepCode === 'CANCELLED');
    if (!cancelledStep) return false;
    return t.workflowInstance.template.transitions.some((tr) => tr.fromStepId === currentStepId && tr.toStepId === cancelledStep.id);
  });
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

  /** แถบลำดับขั้นตอน — แสดงเส้นทางหลัก ส่วนขั้นตอนทางแยก (รออะไหล่/ส่งซ่อมภายนอก) แสดงเฉพาะตอนที่งานอยู่ขั้นนั้นจริง */
  readonly stepTrail = computed(() => {
    const wf = this.ticket()?.workflowInstance;
    if (!wf) return [];
    const current = wf.currentStep;
    return wf.template.steps
      .filter((s) => s.stepOrder < 99 && s.stepCode !== 'DRAFT' && (s.id === current.id || !BRANCH_STEP_CODES.has(s.stepCode)))
      .sort((a, b) => a.stepOrder - b.stepOrder)
      .map((s) => ({
        id: s.id,
        name: s.stepNameTh,
        state: s.id === current.id ? (current.isTerminal ? 'done' : 'current') : s.stepOrder < current.stepOrder ? 'done' : 'todo',
      }));
  });

  /** ตรงกับ assertCanEditAsAssigneeOrReporter ฝั่ง backend: เปลี่ยนขั้นตอน/บันทึกผลตรวจ/สรุปผลซ่อม ทำได้เฉพาะ Admin/Super Admin,
   * ผู้แจ้ง หรือช่างที่ได้รับมอบหมาย — ซ่อนปุ่มที่กดแล้วจะถูกปฏิเสธ 403 เสมอ */
  readonly canEditAsAssigneeOrReporter = computed(() => {
    const t = this.ticket();
    const me = this.authService.currentUser();
    if (!t || !me) return false;
    return me.role === 'SUPER_ADMIN' || me.role === 'ADMIN' || t.reportedBy.id === me.id || t.assignedTechnician?.id === me.id;
  });
  private readonly canUpdateStatus = computed(
    () => this.authService.hasAnyPermission(['ticket:update_status']) && this.canEditAsAssigneeOrReporter(),
  );
  /** มีสิทธิ์เปลี่ยนสถานะทั่วไป แต่งานนี้ไม่ได้มอบหมายให้ตน — แสดงคำอธิบายแทนปุ่ม */
  readonly blockedByAssignment = computed(
    () => this.authService.hasAnyPermission(['ticket:update_status']) && !this.canEditAsAssigneeOrReporter() && this.availableTransitions().length > 0,
  );
  readonly canEditSummary = computed(() => this.canUpdateStatus());
  readonly canReceiveNow = computed(() => this.canReceive() && this.authService.hasAnyPermission(['ticket:receive']));
  readonly showInspectNext = computed(() => this.canUpdateStatus() && this.ticket()?.status === 'RECEIVED' && !this.ticket()?.inspectedAt);
  /** ปุ่มไปขั้นถัดไปตาม workflow — ตัดเส้นทาง "ไปยังรับเรื่อง" ออกเมื่อมีปุ่ม "รับเรื่อง" (endpoint เฉพาะ) อยู่แล้ว กันปุ่มซ้ำ */
  readonly nextTransitions = computed(() =>
    this.canUpdateStatus() ? this.availableTransitions().filter((tr) => !(this.canReceive() && tr.toStep.stepCode === 'RECEIVED')) : [],
  );
  readonly canCloseNow = computed(
    () =>
      this.canClose() &&
      (this.hasFullClosePermission() || this.isOwnTicketReporter()) &&
      this.authService.hasAnyPermission(['ticket:close', 'ticket:accept']),
  );
  readonly hasNextActions = computed(
    () => this.canReceiveNow() || this.showInspectNext() || this.nextTransitions().length > 0 || this.canCloseNow(),
  );
  readonly hasMoreActions = computed(
    () =>
      this.authService.hasAnyPermission(['ticket:assign', 'ticket:update_status', 'spare_part:issue']) ||
      (this.canCancel() && this.authService.hasAnyPermission(['ticket:cancel'])) ||
      (this.canApproveDigitalHealthHead() && this.authService.hasAnyPermission(['ticket:approve'])),
  );
  readonly urgencyColor = URGENCY_COLOR;

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
    this.repairTicketService.getById(id).subscribe({
      next: (ticket) => {
        this.ticket.set(ticket);
        afterNextRender(() => this.scrollTrailToCurrent(), { injector: this.injector });
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        const message = err?.error?.error?.message ?? 'ไม่พบใบแจ้งซ่อมนี้ อาจถูกลบไปแล้วหรือคุณไม่มีสิทธิ์เข้าถึง';
        this.toast.error(message);
        void this.router.navigate(['/repair-tickets']);
      },
    });
    this.repairTicketService.getTimeline(id).subscribe((events) => this.timeline.set(events));
    // โหลดเฉพาะส่วนที่บัญชีมีสิทธิ์ดู — เดิมเรียกทุกครั้ง ผู้แจ้งซ่อม (USER) จึงเห็นแถบ error "ไม่มีสิทธิ์" ทุกครั้งที่เปิดใบงานของตัวเอง
    if (this.authService.hasAnyPermission(['spare_part:view', 'spare_part:manage', 'spare_part:issue'])) {
      this.sparePartService.listTransactions({ ticketId: id, limit: 50 }).subscribe((res) => this.partsUsed.set(res.items));
    }
    if (this.authService.hasAnyPermission(['vendor:view', 'vendor:manage'])) {
      this.vendorRepairOrderService.list({ ticketId: id, limit: 1 }).subscribe((res) => {
        const order = res.items[0] ?? null;
        this.vendorOrder.set(order);
        this.selectedVendorOrderStatus = order?.status ?? '';
      });
    }
  }

  /** มือถือ: แถบขั้นตอนกว้างกว่าจอ — เลื่อนให้เห็นขั้นปัจจุบัน (หรือขั้นสุดท้ายเมื่อปิดงานแล้ว) โดยไม่เลื่อนหน้าทั้งหน้า */
  private scrollTrailToCurrent(): void {
    const el = this.trailScroller?.nativeElement;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const target = el.querySelector<HTMLElement>('[aria-current="step"]');
    el.scrollLeft = target ? target.offsetLeft - (el.clientWidth - target.offsetWidth) / 2 : el.scrollWidth;
  }

  private refresh(message = 'บันทึกเรียบร้อยแล้ว'): void {
    this.acting.set(false);
    this.toast.success(message);
    this.load();
  }

  receive(): void {
    this.acting.set(true);
    this.repairTicketService.receive(this.id()).subscribe({ next: () => this.refresh('รับเรื่องแล้ว'), error: () => this.acting.set(false) });
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

  /** หมวดครุภัณฑ์ที่ถือว่า "ไม่ใช่งานคอมพิวเตอร์" ชัดเจน — ใช้แบบฟอร์มกระดาษของงานพัสดุ (ทั่วไป) แทน
   *  ค่าอื่นทุกกรณี รวมถึงใบแจ้งซ่อมที่ไม่ได้ผูกกับครุภัณฑ์เลย (สร้างจากฟอร์มแจ้งซ่อมด้วยมือ ซึ่งเลือกได้แต่ประเภท
   *  อุปกรณ์คอมพิวเตอร์) ยังคงใช้แบบฟอร์มคอมพิวเตอร์เดิมเป็นค่าเริ่มต้น เพราะไม่มีสัญญาณที่บ่งชี้ชัดพอว่าไม่ใช่งานคอมพิวเตอร์ */
  private static readonly GENERAL_FORM_CATEGORY_CODES = new Set(['AC', 'MEDICAL', 'OTHER']);

  openPrintPreview(): void {
    const t = this.ticket();
    if (!t) return;

    const categoryCode = t.asset?.category?.code;
    const isGeneralForm = !!categoryCode && TicketDetailComponent.GENERAL_FORM_CATEGORY_CODES.has(categoryCode);

    if (isGeneralForm) {
      this.dialog.open(TicketPrintPreviewGeneralComponent, { width: '900px', maxWidth: '95vw', data: { ticket: t } });
    } else {
      this.dialog.open(TicketPrintPreviewComponent, { width: '900px', maxWidth: '95vw', data: { ticket: t } });
    }
  }

  openAssignDialog(): void {
    const ref = this.dialog.open(AssignTechnicianDialogComponent, { width: '420px' });
    ref.afterClosed().subscribe((technicianId: string | undefined) => {
      if (!technicianId) return;
      this.acting.set(true);
      this.repairTicketService.assign(this.id(), technicianId).subscribe({ next: () => this.refresh('มอบหมายช่างแล้ว'), error: () => this.acting.set(false) });
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
              this.toast.success('เบิกอะไหล่แล้ว');
              this.load();
            },
            error: (err) => {
              const message = err?.error?.error?.message ?? 'เบิกอะไหล่ไม่สำเร็จ';
              this.toast.error(message);
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
          this.toast.success('สร้างใบส่งซ่อมภายนอกแล้ว');
        },
        error: () => {
          this.savingVendorOrder.set(false);
          this.toast.error('สร้างใบส่งซ่อมภายนอกไม่สำเร็จ');
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
        this.toast.success('อัปเดตสถานะใบส่งซ่อมภายนอกแล้ว');
        if (updated.status === 'RETURNED') this.load();
      },
      error: () => {
        this.savingVendorOrder.set(false);
        this.toast.error('อัปเดตสถานะไม่สำเร็จ');
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
      this.repairTicketService.cancel(this.id(), reason).subscribe({ next: () => this.refresh('ยกเลิกงานแล้ว'), error: () => this.acting.set(false) });
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
      this.toast.error(`แนบไฟล์ได้สูงสุด ${TicketDetailComponent.MAX_ATTACHMENT_COUNT} ไฟล์ต่อครั้ง`);
      input.value = '';
      return;
    }

    const invalidType = fileList.find(
      (f) => !TicketDetailComponent.ALLOWED_ATTACHMENT_PREFIXES.some((prefix) => f.type.startsWith(prefix)),
    );
    if (invalidType) {
      this.toast.error(`แนบได้เฉพาะไฟล์รูปภาพหรือวิดีโอเท่านั้น (${invalidType.name})`);
      input.value = '';
      return;
    }

    const tooLarge = fileList.find((f) => f.size > TicketDetailComponent.MAX_ATTACHMENT_SIZE_BYTES);
    if (tooLarge) {
      this.toast.error(`ไฟล์ "${tooLarge.name}" มีขนาดเกิน 5 MB`);
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
        this.toast.error('แนบไฟล์ไม่สำเร็จ');
        input.value = '';
      },
    });
  }
}
