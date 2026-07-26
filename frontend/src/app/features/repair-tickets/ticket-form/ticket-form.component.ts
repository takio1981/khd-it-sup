import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RepairTicketService } from '../../../core/services/repair-ticket.service';
import { URGENCY_LABEL_TH } from '../../../core/constants/status.const';
import type { ICreateTicketPayload } from '../../../core/models/repair-ticket.model';

@Component({
  selector: 'khd-ticket-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './ticket-form.component.html',
})
export class TicketFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly repairTicketService = inject(RepairTicketService);
  readonly dialogRef = inject(MatDialogRef<TicketFormComponent>);

  readonly urgencyLabels = URGENCY_LABEL_TH;
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    description: ['', Validators.required],
    urgency: ['MEDIUM', Validators.required],
    problemType: [''],
    locationNote: [''],
    contactPhone: [''],
  });

  submit(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.repairTicketService.create(this.form.getRawValue() as ICreateTicketPayload).subscribe({
      next: (ticket) => {
        this.saving.set(false);
        this.dialogRef.close(ticket);
      },
      error: () => this.saving.set(false),
    });
  }
}
