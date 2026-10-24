import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { IconComponent } from '../icon/icon.component';

export interface IConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

@Component({
  selector: 'khd-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, IconComponent],
  template: `
    <div class="flex gap-4 px-6 pt-6">
      <span
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        [class]="data.danger ? 'bg-red-500/10 text-red-600' : 'bg-brand-primary/10 text-brand-primary'"
      >
        <khd-icon [name]="data.danger ? 'exclamation-triangle' : 'information-circle'" [size]="22" />
      </span>
      <div class="min-w-0 pb-2">
        <h2 class="m-0 text-base font-semibold text-ink">{{ data.title }}</h2>
        <p class="m-0 mt-1.5 whitespace-pre-line text-sm text-muted">{{ data.message }}</p>
      </div>
    </div>
    <mat-dialog-actions align="end" class="!px-6 !pb-5">
      <button mat-button mat-dialog-close>{{ data.cancelLabel ?? 'ยกเลิก' }}</button>
      <button mat-flat-button [color]="data.danger ? 'warn' : 'primary'" [mat-dialog-close]="true" cdkFocusInitial>
        {{ data.confirmLabel ?? 'ยืนยัน' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialogComponent {
  readonly data = inject<IConfirmDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);
}
