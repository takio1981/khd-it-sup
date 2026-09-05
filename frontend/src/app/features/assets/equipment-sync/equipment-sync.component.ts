import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { interval, startWith, switchMap, takeWhile } from 'rxjs';
import { EquipmentSyncService } from '../../../core/services/equipment-sync.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import type { IEquipmentSyncStatus } from '../../../core/models/equipment-sync.model';
import { KhdNumberPipe } from '../../../shared/pipes/khd-number.pipe';

const POLL_INTERVAL_MS = 3000;

@Component({
  selector: 'khd-equipment-sync',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatProgressSpinnerModule, MatExpansionModule, IconComponent, KhdNumberPipe],
  templateUrl: './equipment-sync.component.html',
})
export class EquipmentSyncComponent {
  private readonly equipmentSyncService = inject(EquipmentSyncService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<IEquipmentSyncStatus | null>(null);
  readonly loadingStatus = signal(true);
  readonly running = computed(() => this.status()?.isRunning ?? false);
  readonly lastRun = computed(() => this.status()?.lastRun ?? null);

  constructor() {
    this.equipmentSyncService.getStatus().subscribe({
      next: (status) => {
        this.status.set(status);
        this.loadingStatus.set(false);
        if (status.isRunning) this.pollUntilDone();
      },
      error: () => this.loadingStatus.set(false),
    });
  }

  startImport(): void {
    this.equipmentSyncService.triggerSync().subscribe({
      next: () => this.pollUntilDone(),
      error: (err) => {
        const message = err?.error?.error?.message ?? 'เริ่มการซิงค์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
        this.snackBar.open(message, 'ปิด', { duration: 4000 });
      },
    });
  }

  private pollUntilDone(): void {
    interval(POLL_INTERVAL_MS)
      .pipe(
        startWith(0),
        switchMap(() => this.equipmentSyncService.getStatus()),
        takeWhile((s) => s.isRunning, true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((s) => this.status.set(s));
  }

  formatDateTime(iso: string | null | undefined): string {
    return iso ? new Date(iso).toLocaleString('th-TH') : '—';
  }
}
