import { ChangeDetectionStrategy, Component, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { UserService, type ITechnician } from '../../../core/services/user.service';
import { INSPECTION_OUTCOME_LABEL_TH } from '../../../core/constants/status.const';
import { SignaturePadComponent } from '../../../shared/components/signature-pad/signature-pad.component';
import type { IRepairSummaryPayload } from '../../../core/services/repair-ticket.service';
import type { IInspectionPayload, InspectionOutcome } from '../../../core/models/repair-ticket.model';
import type { ISparePart } from '../../../core/models/spare-part.model';

/** Dialog เล็ก ๆ สำหรับใส่เหตุผลยกเลิกใบแจ้งซ่อม (บังคับกรอกตาม business rule) */
@Component({
  selector: 'khd-cancel-ticket-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>ยกเลิกใบแจ้งซ่อม</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="w-full">
        <mat-label>เหตุผลการยกเลิก</mat-label>
        <textarea matInput [formControl]="reason" rows="3"></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>ปิด</button>
      <button mat-flat-button color="warn" [disabled]="reason.invalid" [mat-dialog-close]="reason.value">ยืนยันยกเลิก</button>
    </mat-dialog-actions>
  `,
})
export class CancelTicketDialogComponent {
  readonly reason = new FormControl('', { nonNullable: true, validators: Validators.required });
}

/** Dialog เล็ก ๆ สำหรับเลือกช่างเทคนิค/เจ้าหน้าที่ไอทีที่จะมอบหมายงานซ่อมให้ */
@Component({
  selector: 'khd-assign-technician-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatSelectModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>มอบหมายช่างผู้รับผิดชอบ</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="w-full">
        <mat-label>ช่างเทคนิค / เจ้าหน้าที่ไอที</mat-label>
        <mat-select [formControl]="technicianId">
          @for (t of technicians(); track t.id) {
            <mat-option [value]="t.id">{{ t.fullName }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>ปิด</button>
      <button mat-flat-button color="primary" [disabled]="technicianId.invalid" [mat-dialog-close]="technicianId.value">
        มอบหมาย
      </button>
    </mat-dialog-actions>
  `,
})
export class AssignTechnicianDialogComponent {
  private readonly userService = inject(UserService);
  readonly technicianId = new FormControl('', { nonNullable: true, validators: Validators.required });
  readonly technicians = signal<ITechnician[]>([]);

  constructor() {
    this.userService.listTechnicians().subscribe((list) => this.technicians.set(list));
  }
}

export interface IRepairSummaryDialogData {
  mode: 'complete' | 'edit';
  initial?: {
    rootCause: string | null;
    repairAction: string | null;
    partsUsed: string | null;
    recommendation: string | null;
  };
}

/** Dialog สรุปผลการซ่อมจากช่าง — ใช้ทั้งตอนบังคับกรอกก่อนเปลี่ยนสถานะเป็น "ซ่อมเสร็จสิ้น" (mode: complete)
 *  และตอนแก้ไขสรุปผลย้อนหลังโดยไม่เปลี่ยนสถานะ (mode: edit) */
@Component({
  selector: 'khd-repair-summary-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, SignaturePadComponent],
  template: `
    <h2 mat-dialog-title>{{ data.mode === 'edit' ? 'แก้ไขสรุปผลการซ่อม' : 'สรุปผลการซ่อม' }}</h2>
    <form [formGroup]="form">
      <mat-dialog-content class="!flex !flex-col !gap-1 !max-h-[70vh]">
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>สาเหตุที่พบ</mat-label>
          <textarea matInput formControlName="rootCause" rows="2" placeholder="เช่น พาวเวอร์ซัพพลายเสีย, ไวรัสเข้าเครื่อง"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>วิธีการดำเนินการซ่อม</mat-label>
          <textarea matInput formControlName="repairAction" rows="2" placeholder="เช่น เปลี่ยนพาวเวอร์ซัพพลาย, ล้างไวรัสและติดตั้งระบบใหม่"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>อะไหล่/อุปกรณ์ที่ใช้ (ถ้ามี)</mat-label>
          <textarea matInput formControlName="partsUsed" rows="2"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>ข้อเสนอแนะ/คำแนะนำป้องกัน (ถ้ามี)</mat-label>
          <textarea matInput formControlName="recommendation" rows="2"></textarea>
        </mat-form-field>
        <div>
          <p class="text-xs text-neutral-500 mb-1">ลายเซ็นช่างผู้ซ่อม (ถ้ามี — เซ็นได้จากหน้าจอมือถือ/แท็บเล็ตโดยตรง)</p>
          <khd-signature-pad #sigPad />
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>ยกเลิก</button>
        <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="submit(sigPad)">
          {{ data.mode === 'edit' ? 'บันทึกการแก้ไข' : 'บันทึกและซ่อมเสร็จสิ้น' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class RepairSummaryDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<RepairSummaryDialogComponent>);
  readonly data = inject<IRepairSummaryDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? { mode: 'complete' };

  readonly form = this.fb.nonNullable.group({
    rootCause: [this.data.initial?.rootCause ?? '', Validators.required],
    repairAction: [this.data.initial?.repairAction ?? '', Validators.required],
    partsUsed: [this.data.initial?.partsUsed ?? ''],
    recommendation: [this.data.initial?.recommendation ?? ''],
  });

  submit(sigPad: SignaturePadComponent): void {
    if (this.form.invalid) return;
    const payload: IRepairSummaryPayload = { ...this.form.getRawValue(), summarySignature: sigPad.getDataUrl() ?? undefined };
    this.dialogRef.close(payload);
  }
}

/** Dialog บันทึกผลตรวจสอบเบื้องต้นโดยเจ้าหน้าที่ไอที (ส่วนที่ 2 ของแบบฟอร์มกระดาษ — ก่อนเริ่มซ่อมจริง) */
@Component({
  selector: 'khd-inspection-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>บันทึกผลตรวจสอบเบื้องต้น</h2>
    <form [formGroup]="form">
      <mat-dialog-content class="!flex !flex-col !gap-1 !max-h-[70vh]">
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>ผลการตรวจสอบ</mat-label>
          <mat-select formControlName="inspectionOutcome">
            <mat-option value="IN_HOUSE">{{ outcomeLabels['IN_HOUSE'] }}</mat-option>
            <mat-option value="SEND_EXTERNAL">{{ outcomeLabels['SEND_EXTERNAL'] }}</mat-option>
            <mat-option value="REPLACE_NEW">{{ outcomeLabels['REPLACE_NEW'] }}</mat-option>
          </mat-select>
        </mat-form-field>

        @if (form.value.inspectionOutcome === 'IN_HOUSE') {
          <mat-checkbox formControlName="requestPartsNeeded" class="!mb-2">ขออนุมัติซื้ออะไหล่</mat-checkbox>
          @if (form.value.requestPartsNeeded) {
            <div class="grid grid-cols-[1fr_90px] gap-x-2">
              <mat-form-field appearance="outline"><mat-label>อะไหล่ 1</mat-label><input matInput formControlName="requestedPart1Name" /></mat-form-field>
              <mat-form-field appearance="outline"><mat-label>จำนวน</mat-label><input matInput type="number" formControlName="requestedPart1Qty" /></mat-form-field>
              <mat-form-field appearance="outline"><mat-label>อะไหล่ 2</mat-label><input matInput formControlName="requestedPart2Name" /></mat-form-field>
              <mat-form-field appearance="outline"><mat-label>จำนวน</mat-label><input matInput type="number" formControlName="requestedPart2Qty" /></mat-form-field>
              <mat-form-field appearance="outline"><mat-label>อะไหล่ 3</mat-label><input matInput formControlName="requestedPart3Name" /></mat-form-field>
              <mat-form-field appearance="outline"><mat-label>จำนวน</mat-label><input matInput type="number" formControlName="requestedPart3Qty" /></mat-form-field>
            </div>
          }
        }

        @if (form.value.inspectionOutcome === 'SEND_EXTERNAL') {
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>เหตุผลที่ส่งซ่อมภายนอก</mat-label>
            <textarea matInput formControlName="sendExternalReason" rows="2"></textarea>
          </mat-form-field>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>ยกเลิก</button>
        <button mat-flat-button color="primary" [disabled]="form.invalid" [mat-dialog-close]="buildPayload()">บันทึก</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class InspectionDialogComponent {
  private readonly fb = inject(FormBuilder);
  readonly outcomeLabels = INSPECTION_OUTCOME_LABEL_TH;

  readonly form = this.fb.nonNullable.group({
    inspectionOutcome: ['', Validators.required],
    requestPartsNeeded: [false],
    requestedPart1Name: [''],
    requestedPart1Qty: [null as number | null],
    requestedPart2Name: [''],
    requestedPart2Qty: [null as number | null],
    requestedPart3Name: [''],
    requestedPart3Qty: [null as number | null],
    sendExternalReason: [''],
  });

  constructor() {
    this.syncReasonValidator();
    this.form.controls.inspectionOutcome.valueChanges.subscribe(() => this.syncReasonValidator());
  }

  private syncReasonValidator(): void {
    const ctrl = this.form.controls.sendExternalReason;
    if (this.form.controls.inspectionOutcome.value === 'SEND_EXTERNAL') {
      ctrl.setValidators([Validators.required]);
    } else {
      ctrl.clearValidators();
    }
    ctrl.updateValueAndValidity({ emitEvent: false });
  }

  buildPayload(): IInspectionPayload {
    const raw = this.form.getRawValue();
    return {
      inspectionOutcome: raw.inspectionOutcome as InspectionOutcome,
      requestPartsNeeded: raw.requestPartsNeeded,
      requestedPart1Name: raw.requestedPart1Name || undefined,
      requestedPart1Qty: raw.requestedPart1Qty ?? undefined,
      requestedPart2Name: raw.requestedPart2Name || undefined,
      requestedPart2Qty: raw.requestedPart2Qty ?? undefined,
      requestedPart3Name: raw.requestedPart3Name || undefined,
      requestedPart3Qty: raw.requestedPart3Qty ?? undefined,
      sendExternalReason: raw.sendExternalReason || undefined,
    };
  }
}

export interface IIssuePartDialogData {
  parts: ISparePart[];
}

export interface IIssuePartDialogResult {
  sparePartId: string;
  quantity: number;
  note: string;
}

/** Dialog เบิกอะไหล่ผูกกับใบแจ้งซ่อมนี้ (บันทึกเป็น transaction type=ISSUE ตัด quantityOnHand ทันที) */
@Component({
  selector: 'khd-issue-part-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>เบิกอะไหล่</h2>
    <form [formGroup]="form">
      <mat-dialog-content class="!flex !flex-col !gap-1">
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>อะไหล่</mat-label>
          <mat-select formControlName="sparePartId">
            @for (p of data.parts; track p.id) {
              <mat-option [value]="p.id" [disabled]="p.quantityOnHand <= 0">
                {{ p.code }} - {{ p.name }} (คงเหลือ {{ p.quantityOnHand }} {{ p.unit }})
              </mat-option>
            }
          </mat-select>
          @if (data.parts.length === 0) {
            <mat-hint>ยังไม่มีอะไหล่ในระบบ — เพิ่มได้ที่เมนู "คลังอะไหล่"</mat-hint>
          }
        </mat-form-field>
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>จำนวน</mat-label>
          <input matInput type="number" formControlName="quantity" min="1" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>หมายเหตุ (ถ้ามี)</mat-label>
          <input matInput formControlName="note" />
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>ยกเลิก</button>
        <button mat-flat-button color="primary" [disabled]="form.invalid" [mat-dialog-close]="form.getRawValue()">เบิกอะไหล่</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class IssuePartDialogComponent {
  private readonly fb = inject(FormBuilder);
  readonly data = inject<IIssuePartDialogData>(MAT_DIALOG_DATA);

  readonly form = this.fb.nonNullable.group({
    sparePartId: ['', Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
    note: [''],
  });
}

export interface IAcceptTicketDialogData {
  /** true = ผู้แจ้งซ่อมเองเซ็นรับงานผ่านสิทธิ์ ticket:accept (บังคับเซ็น) — false = แอดมินปิดงานแทนผ่าน ticket:close (เซ็นได้แต่ไม่บังคับ) */
  requireSignature: boolean;
}

export interface IAcceptTicketDialogResult {
  acceptorSignature?: string;
}

/** Dialog ปิดงาน/เซ็นรับงานคืน — แสดงเป็น "เซ็นรับงาน" (บังคับเซ็น) เมื่อผู้แจ้งซ่อมปิดงานของตนเอง หรือ "ปิดงาน"
 *  (เซ็นได้แต่ไม่บังคับ) เมื่อแอดมิน/ไอทีปิดงานแทน — ลายเซ็นเซ็นได้จากหน้าจอมือถือ/แท็บเล็ตโดยตรงผ่าน khd-signature-pad */
@Component({
  selector: 'khd-accept-ticket-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, SignaturePadComponent],
  template: `
    <h2 mat-dialog-title>{{ data.requireSignature ? 'เซ็นรับงาน' : 'ปิดงาน' }}</h2>
    <mat-dialog-content>
      <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
        {{
          data.requireSignature
            ? 'กรุณาเซ็นชื่อยืนยันว่าท่านได้รับอุปกรณ์คืนเรียบร้อยแล้ว'
            : 'ยืนยันปิดงานซ่อมนี้ (เซ็นชื่อผู้ตรวจรับงานได้ถ้าต้องการ ไม่บังคับ)'
        }}
      </p>
      <khd-signature-pad #sigPad />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>ยกเลิก</button>
      <button mat-flat-button color="primary" [disabled]="data.requireSignature && sigPad.isEmpty()" (click)="submit(sigPad)">
        ยืนยัน
      </button>
    </mat-dialog-actions>
  `,
})
export class AcceptTicketDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<AcceptTicketDialogComponent>);
  readonly data = inject<IAcceptTicketDialogData>(MAT_DIALOG_DATA);

  submit(sigPad: SignaturePadComponent): void {
    if (this.data.requireSignature && sigPad.isEmpty()) return;
    const result: IAcceptTicketDialogResult = { acceptorSignature: sigPad.getDataUrl() ?? undefined };
    this.dialogRef.close(result);
  }
}
