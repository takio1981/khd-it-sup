import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RepairTicketService } from '../../../core/services/repair-ticket.service';
import { EQUIPMENT_TYPE_LABEL_TH, EQUIPMENT_TYPE_OPTIONS, URGENCY_LABEL_TH } from '../../../core/constants/status.const';
import type { ICreateTicketPayload } from '../../../core/models/repair-ticket.model';

@Component({
  selector: 'khd-ticket-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './ticket-form.component.html',
})
export class TicketFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly repairTicketService = inject(RepairTicketService);
  readonly dialogRef = inject(MatDialogRef<TicketFormComponent>);

  readonly urgencyLabels = URGENCY_LABEL_TH;
  readonly equipmentTypeOptions = EQUIPMENT_TYPE_OPTIONS;
  readonly equipmentTypeLabels = EQUIPMENT_TYPE_LABEL_TH;
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    description: ['', Validators.required],
    urgency: ['MEDIUM', Validators.required],
    problemType: [''],
    locationNote: [''],
    contactPhone: [''],
    equipmentType: [''],
    equipmentTypeOther: [''],
    deviceColor: [''],
    hasAdapterCable: [false],
    hasVgaCable: [false],
    hasPowerCable: [false],
    hasOtherAccessory: [false],
    otherAccessoryNote: [''],
  });

  submit(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    const raw = this.form.getRawValue();
    this.repairTicketService
      .create({
        description: raw.description,
        urgency: raw.urgency as ICreateTicketPayload['urgency'],
        problemType: raw.problemType || undefined,
        locationNote: raw.locationNote || undefined,
        contactPhone: raw.contactPhone || undefined,
        equipmentType: (raw.equipmentType || undefined) as ICreateTicketPayload['equipmentType'],
        equipmentTypeOther: raw.equipmentTypeOther || undefined,
        deviceColor: raw.deviceColor || undefined,
        hasAdapterCable: raw.hasAdapterCable,
        hasVgaCable: raw.hasVgaCable,
        hasPowerCable: raw.hasPowerCable,
        hasOtherAccessory: raw.hasOtherAccessory,
        otherAccessoryNote: raw.otherAccessoryNote || undefined,
      })
      .subscribe({
        next: (ticket) => {
          this.saving.set(false);
          this.dialogRef.close(ticket);
        },
        error: () => this.saving.set(false),
      });
  }
}
