import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AssetLoanService } from '../../../core/services/asset-loan.service';
import { LOAN_CONDITION_OPTIONS, OTHER_OPTION } from '../asset-loan.const';
import type { IAssetLoan } from '../../../core/models/asset-loan.model';

export interface IAssetLoanReturnFormDialogData {
  loan: IAssetLoan;
}

@Component({
  selector: 'khd-asset-loan-return-form',
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
  templateUrl: './asset-loan-return-form.component.html',
})
export class AssetLoanReturnFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly assetLoanService = inject(AssetLoanService);
  readonly dialogRef = inject(MatDialogRef<AssetLoanReturnFormComponent>);
  readonly data = inject<IAssetLoanReturnFormDialogData>(MAT_DIALOG_DATA);

  readonly saving = signal(false);
  readonly conditionOptions = LOAN_CONDITION_OPTIONS;
  readonly otherOption = OTHER_OPTION;

  readonly form = this.fb.nonNullable.group({
    conditionOnReturn: [''],
    conditionOnReturnOther: [''],
  });

  submit(): void {
    if (this.saving()) return;
    this.saving.set(true);

    const raw = this.form.getRawValue();
    const conditionOnReturn = raw.conditionOnReturn === this.otherOption ? raw.conditionOnReturnOther : raw.conditionOnReturn;

    this.assetLoanService.returnLoan(this.data.loan.id, conditionOnReturn || undefined).subscribe({
      next: (loan) => {
        this.saving.set(false);
        this.dialogRef.close(loan);
      },
      error: () => this.saving.set(false),
    });
  }
}
