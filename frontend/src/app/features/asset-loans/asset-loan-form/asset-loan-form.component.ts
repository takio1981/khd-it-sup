import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AssetLoanService } from '../../../core/services/asset-loan.service';
import { AssetService } from '../../../core/services/asset.service';
import { UserService } from '../../../core/services/user.service';
import { LOAN_CONDITION_OPTIONS, LOAN_PURPOSE_OPTIONS, OTHER_OPTION, resolveDropdownPrefill } from '../asset-loan.const';
import type { IAsset } from '../../../core/models/asset.model';
import type { IUserListItem } from '../../../core/models/user.model';
import type { IAssetLoan } from '../../../core/models/asset-loan.model';

/** แปลง ISO date string จาก backend เป็น Date แบบ local calendar day (ไม่ผ่าน UTC เพื่อกันวันเลื่อน) */
function toCalendarDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** แปลง Date ที่เลือกจากปฏิทินกลับเป็น yyyy-MM-dd โดยอ่านค่าจาก local time เท่านั้น (กัน toISOString เลื่อนวัน) */
function fromCalendarDate(date: Date | null | undefined): string | undefined {
  if (!date) return undefined;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface IAssetLoanFormDialogData {
  loan?: IAssetLoan | null;
  borrowedAssetIds: Set<string>;
}

@Component({
  selector: 'khd-asset-loan-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './asset-loan-form.component.html',
})
export class AssetLoanFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly assetLoanService = inject(AssetLoanService);
  private readonly assetService = inject(AssetService);
  private readonly userService = inject(UserService);
  readonly dialogRef = inject(MatDialogRef<AssetLoanFormComponent>);
  readonly data = inject<IAssetLoanFormDialogData>(MAT_DIALOG_DATA);

  readonly saving = signal(false);
  readonly assets = signal<IAsset[]>([]);
  readonly users = signal<IUserListItem[]>([]);
  readonly availableAssets = signal<IAsset[]>([]);

  readonly purposeOptions = LOAN_PURPOSE_OPTIONS;
  readonly conditionOptions = LOAN_CONDITION_OPTIONS;
  readonly otherOption = OTHER_OPTION;

  readonly isEdit = !!this.data.loan;
  readonly showReturnFields = !!this.data.loan?.actualReturnDate;

  private readonly purposePrefill = resolveDropdownPrefill(this.data.loan?.purpose, LOAN_PURPOSE_OPTIONS);
  private readonly conditionBorrowPrefill = resolveDropdownPrefill(this.data.loan?.conditionOnBorrow, LOAN_CONDITION_OPTIONS);
  private readonly conditionReturnPrefill = resolveDropdownPrefill(this.data.loan?.conditionOnReturn, LOAN_CONDITION_OPTIONS);

  readonly form = this.fb.nonNullable.group({
    assetId: [this.data.loan?.assetId ?? '', Validators.required],
    borrowerId: [this.data.loan?.borrowerId ?? '', Validators.required],
    expectedReturnDate: [toCalendarDate(this.data.loan?.expectedReturnDate) as Date | null, Validators.required],
    purpose: [this.purposePrefill.select, Validators.required],
    purposeOther: [this.purposePrefill.other],
    conditionOnBorrow: [this.conditionBorrowPrefill.select, Validators.required],
    conditionOnBorrowOther: [this.conditionBorrowPrefill.other],
    conditionOnReturn: [this.conditionReturnPrefill.select],
    conditionOnReturnOther: [this.conditionReturnPrefill.other],
  });

  constructor() {
    this.assetService.list({ page: 1, limit: 200 }).subscribe((res) => {
      this.assets.set(res.items);
      this.availableAssets.set(
        res.items.filter((a) => !this.data.borrowedAssetIds.has(a.id) || a.id === this.data.loan?.assetId),
      );
    });
    this.userService.list({ page: 1, limit: 200 }).subscribe((res) => this.users.set(res.items));

    this.syncOtherValidator('purpose', 'purposeOther');
    this.syncOtherValidator('conditionOnBorrow', 'conditionOnBorrowOther');
    this.form.controls.purpose.valueChanges.subscribe(() => this.syncOtherValidator('purpose', 'purposeOther'));
    this.form.controls.conditionOnBorrow.valueChanges.subscribe(() =>
      this.syncOtherValidator('conditionOnBorrow', 'conditionOnBorrowOther'),
    );
  }

  /** ทำให้ช่อง "ระบุเพิ่มเติม" เป็นค่าบังคับก็ต่อเมื่อ dropdown คู่กันเลือก "อื่นๆ" ไว้ */
  private syncOtherValidator(selectKey: 'purpose' | 'conditionOnBorrow', otherKey: 'purposeOther' | 'conditionOnBorrowOther'): void {
    const otherCtrl = this.form.controls[otherKey];
    if (this.form.controls[selectKey].value === this.otherOption) {
      otherCtrl.setValidators([Validators.required]);
    } else {
      otherCtrl.clearValidators();
    }
    otherCtrl.updateValueAndValidity({ emitEvent: false });
  }

  submit(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    const raw = this.form.getRawValue();
    const purpose = raw.purpose === this.otherOption ? raw.purposeOther : raw.purpose;
    const conditionOnBorrow = raw.conditionOnBorrow === this.otherOption ? raw.conditionOnBorrowOther : raw.conditionOnBorrow;
    const expectedReturnDate = fromCalendarDate(raw.expectedReturnDate);

    const request$ = this.isEdit
      ? this.assetLoanService.update(this.data.loan!.id, {
          assetId: raw.assetId,
          borrowerId: raw.borrowerId,
          expectedReturnDate,
          purpose: purpose || undefined,
          conditionOnBorrow: conditionOnBorrow || undefined,
          ...(this.showReturnFields
            ? { conditionOnReturn: (raw.conditionOnReturn === this.otherOption ? raw.conditionOnReturnOther : raw.conditionOnReturn) || undefined }
            : {}),
        })
      : this.assetLoanService.create({
          assetId: raw.assetId,
          borrowerId: raw.borrowerId,
          expectedReturnDate,
          purpose: purpose || undefined,
          conditionOnBorrow: conditionOnBorrow || undefined,
        });

    request$.subscribe({
      next: (loan) => {
        this.saving.set(false);
        this.dialogRef.close(loan);
      },
      error: () => this.saving.set(false),
    });
  }
}
