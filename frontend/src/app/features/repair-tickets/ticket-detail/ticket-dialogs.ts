import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { UserService, type ITechnician } from '../../../core/services/user.service';

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
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
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
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>ยกเลิก</button>
        <button mat-flat-button color="primary" [disabled]="form.invalid" [mat-dialog-close]="form.getRawValue()">
          {{ data.mode === 'edit' ? 'บันทึกการแก้ไข' : 'บันทึกและซ่อมเสร็จสิ้น' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class RepairSummaryDialogComponent {
  private readonly fb = inject(FormBuilder);
  readonly data = inject<IRepairSummaryDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? { mode: 'complete' };

  readonly form = this.fb.nonNullable.group({
    rootCause: [this.data.initial?.rootCause ?? '', Validators.required],
    repairAction: [this.data.initial?.repairAction ?? '', Validators.required],
    partsUsed: [this.data.initial?.partsUsed ?? ''],
    recommendation: [this.data.initial?.recommendation ?? ''],
  });
}
