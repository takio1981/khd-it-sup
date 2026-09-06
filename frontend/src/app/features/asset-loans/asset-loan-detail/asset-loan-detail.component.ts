import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AssetLoanService } from '../../../core/services/asset-loan.service';
import { AuthService } from '../../../core/services/auth.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { KhdNumberPipe } from '../../../shared/pipes/khd-number.pipe';
import { AssetLoanTransferFormComponent } from '../asset-loan-transfer-form/asset-loan-transfer-form.component';
import { AssetLoanReturnFormComponent } from '../asset-loan-return-form/asset-loan-return-form.component';
import type { IAssetLoan, AssetLoanStatus } from '../../../core/models/asset-loan.model';
import type { AssetLoanTimelineEventType, IAssetLoanTimelineEvent } from '../../../core/models/asset-loan-timeline.model';

const STATUS_LABEL_TH: Record<AssetLoanStatus, string> = { BORROWED: 'กำลังยืม', OVERDUE: 'เกินกำหนด', RETURNED: 'คืนแล้ว' };
const STATUS_COLOR: Record<AssetLoanStatus, string> = { BORROWED: '#3B82F6', OVERDUE: '#EF4444', RETURNED: '#22C55E' };

const EVENT_ICON: Record<AssetLoanTimelineEventType, string> = {
  BORROW: 'arrow-path',
  TRANSFER: 'paper-airplane',
  REMINDER_SENT: 'exclamation-triangle',
  RETURN: 'check-circle',
  NOTE: 'pencil-square',
};

const EVENT_LABEL_TH: Record<AssetLoanTimelineEventType, string> = {
  BORROW: 'ยืมอุปกรณ์',
  TRANSFER: 'ส่งต่อ/ย้าย',
  REMINDER_SENT: 'แจ้งเตือนเกินกำหนดคืน',
  RETURN: 'คืนอุปกรณ์',
  NOTE: 'บันทึกเพิ่มเติม',
};

@Component({
  selector: 'khd-asset-loan-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, MatButtonModule, MatProgressSpinnerModule, IconComponent, KhdNumberPipe],
  templateUrl: './asset-loan-detail.component.html',
})
export class AssetLoanDetailComponent {
  private readonly assetLoanService = inject(AssetLoanService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  /** ผูกอัตโนมัติจาก route param :id */
  readonly id = input<string>('');

  readonly loan = signal<IAssetLoan | null>(null);
  readonly timeline = signal<IAssetLoanTimelineEvent[]>([]);
  readonly loading = signal(true);

  readonly statusLabel = STATUS_LABEL_TH;
  readonly statusColor = STATUS_COLOR;
  readonly eventIcon = EVENT_ICON;
  readonly eventLabel = EVENT_LABEL_TH;

  readonly hasFullPerm = computed(() => this.authService.hasAnyPermission(['asset:loan']));
  readonly isCurrentHolder = computed(() => {
    const l = this.loan();
    const user = this.authService.currentUser();
    return !!l && !!user && (l.currentHolder?.id ?? l.borrower.id) === user.id;
  });
  readonly canTransfer = computed(() => {
    const l = this.loan();
    return !!l && l.status !== 'RETURNED' && (this.hasFullPerm() || this.isCurrentHolder());
  });
  readonly canReturn = computed(() => this.hasFullPerm() && this.loan()?.status !== 'RETURNED');

  constructor() {
    // ใช้ effect() แทนการเรียก load() ตรง ๆ เพราะ withComponentInputBinding() ผูกค่า id
    // เข้ากับ route param "หลัง" constructor ทำงาน ไม่ใช่ระหว่างนั้น — ต้อง react ต่อการเปลี่ยนแปลงของ id()
    effect(() => {
      if (this.id()) this.load();
    });
  }

  currentLocationLabel(l: IAssetLoan): string | null {
    const parts = [l.currentBuilding?.name, l.currentFloor?.name, l.currentRoom?.name].filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : (l.currentLocationNote ?? null);
  }

  takenToLocationLabel(l: IAssetLoan): string | null {
    const parts = [l.takenToBuilding?.name, l.takenToFloor?.name, l.takenToRoom?.name].filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : null;
  }

  eventLocationLabel(e: IAssetLoanTimelineEvent): string | null {
    const parts = [e.building?.name, e.floor?.name, e.room?.name].filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : null;
  }

  private load(): void {
    const id = this.id();
    if (!id) return;
    this.loading.set(true);
    this.assetLoanService.getById(id).subscribe({
      next: (loan) => {
        this.loan.set(loan);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        const message = err?.error?.error?.message ?? 'ไม่พบรายการยืมนี้ อาจถูกลบไปแล้วหรือคุณไม่มีสิทธิ์เข้าถึง';
        this.snackBar.open(message, 'ปิด', { duration: 4000 });
        void this.router.navigate(['/asset-loans']);
      },
    });
    this.assetLoanService.getTimeline(id).subscribe((events) => this.timeline.set(events));
  }

  private refresh(): void {
    const id = this.id();
    if (!id) return;
    this.assetLoanService.getById(id).subscribe((loan) => this.loan.set(loan));
    this.assetLoanService.getTimeline(id).subscribe((events) => this.timeline.set(events));
  }

  openTransferForm(): void {
    const loan = this.loan();
    if (!loan) return;
    const ref = this.dialog.open(AssetLoanTransferFormComponent, { width: '480px', data: { loan } });
    ref.afterClosed().subscribe((result) => result && this.refresh());
  }

  openReturnForm(): void {
    const loan = this.loan();
    if (!loan) return;
    const ref = this.dialog.open(AssetLoanReturnFormComponent, { width: '420px', data: { loan } });
    ref.afterClosed().subscribe((result) => result && this.refresh());
  }
}
