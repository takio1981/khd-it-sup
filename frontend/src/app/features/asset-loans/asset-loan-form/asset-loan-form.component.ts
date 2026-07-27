import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AssetLoanService } from '../../../core/services/asset-loan.service';
import { AssetService } from '../../../core/services/asset.service';
import { UserService } from '../../../core/services/user.service';
import { LOAN_CONDITION_OPTIONS, LOAN_PURPOSE_OPTIONS, OTHER_OPTION } from '../asset-loan.const';
import type { IAsset } from '../../../core/models/asset.model';
import type { IUserListItem } from '../../../core/models/user.model';

export interface IAssetLoanFormDialogData {
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
    MatProgressSpinnerModule,
  ],
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

  readonly form = this.fb.nonNullable.group({
    assetId: ['', Validators.required],
    borrowerId: ['', Validators.required],
    expectedReturnDate: [''],
    purpose: [''],
    purposeOther: [''],
    conditionOnBorrow: [''],
    conditionOnBorrowOther: [''],
  });

  constructor() {
    this.assetService.list({ page: 1, limit: 200 }).subscribe((res) => {
      this.assets.set(res.items);
      this.availableAssets.set(res.items.filter((a) => !this.data.borrowedAssetIds.has(a.id)));
    });
    this.userService.list({ page: 1, limit: 200 }).subscribe((res) => this.users.set(res.items));
  }

  submit(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    const raw = this.form.getRawValue();
    const purpose = raw.purpose === this.otherOption ? raw.purposeOther : raw.purpose;
    const conditionOnBorrow = raw.conditionOnBorrow === this.otherOption ? raw.conditionOnBorrowOther : raw.conditionOnBorrow;

    this.assetLoanService
      .create({
        assetId: raw.assetId,
        borrowerId: raw.borrowerId,
        expectedReturnDate: raw.expectedReturnDate || undefined,
        purpose: purpose || undefined,
        conditionOnBorrow: conditionOnBorrow || undefined,
      })
      .subscribe({
        next: (loan) => {
          this.saving.set(false);
          this.dialogRef.close(loan);
        },
        error: () => this.saving.set(false),
      });
  }
}
