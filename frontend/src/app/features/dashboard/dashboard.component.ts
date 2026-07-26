import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { DashboardService } from '../../core/services/dashboard.service';
import { UserService } from '../../core/services/user.service';
import { DepartmentService } from '../../core/services/department.service';
import { PositionService } from '../../core/services/position.service';
import { DivisionService } from '../../core/services/division.service';
import { LocationService } from '../../core/services/location.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { BarChartComponent, type IBarChartDatum } from '../../shared/components/bar-chart/bar-chart.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { getStatusColor, getStatusLabel } from '../../core/constants/status.const';
import type {
  IDashboardAnalytics,
  IDashboardSummary,
  IDepartmentRankingItem,
  IMonthlyChartPoint,
  ITechnicianWorkloadItem,
} from '../../core/models/dashboard.model';
import type { IDepartment, IDivision, IPosition, IUserStats } from '../../core/models/user.model';
import type { IRoom } from '../../core/models/location.model';
import type { NotificationChannel } from '../../core/models/notification.model';

const THAI_MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const IN_PROGRESS_STATUSES = new Set(['IN_REPAIR', 'WAITING_PARTS', 'MAINTENANCE']);
const OFF_STATUSES = new Set(['INACTIVE', 'DISPOSED', 'LOST']);
const CHANNEL_LABEL_TH: Record<NotificationChannel, string> = {
  EMAIL: 'อีเมล',
  TELEGRAM: 'Telegram',
  LINE: 'LINE',
  PUSH: 'Push',
  SMS: 'SMS',
};

@Component({
  selector: 'khd-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatTabsModule, StatCardComponent, BarChartComponent, IconComponent, HasPermissionDirective],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  private readonly dashboardService = inject(DashboardService);
  private readonly userService = inject(UserService);
  private readonly departmentService = inject(DepartmentService);
  private readonly positionService = inject(PositionService);
  private readonly divisionService = inject(DivisionService);
  private readonly locationService = inject(LocationService);
  private readonly notificationService = inject(NotificationService);
  private readonly authService = inject(AuthService);

  readonly summary = signal<IDashboardSummary | null>(null);
  readonly monthly = signal<IMonthlyChartPoint[]>([]);
  readonly departmentRanking = signal<IDepartmentRankingItem[]>([]);
  readonly technicianWorkload = signal<ITechnicianWorkloadItem[]>([]);
  readonly analytics = signal<IDashboardAnalytics | null>(null);
  readonly loading = signal(true);

  // --- ผู้ใช้งาน ---
  readonly userStats = signal<IUserStats | null>(null);

  // --- ตำแหน่งงาน ---
  readonly positions = signal<IPosition[]>([]);

  // --- หน่วยงาน / แผนก ---
  readonly departments = signal<IDepartment[]>([]);
  readonly divisions = signal<IDivision[]>([]);
  readonly rooms = signal<IRoom[]>([]);
  readonly topLevelDeptCount = computed(() => this.departments().filter((d) => !d.parentId).length);
  readonly subDeptCount = computed(() => this.departments().filter((d) => d.parentId).length);

  // --- การแจ้งเตือน ---
  readonly notifTotal = signal(0);
  readonly notifSent = signal(0);
  readonly notifPending = signal(0);
  readonly notifFailed = signal(0);
  readonly notifByChannel = signal<{ channel: NotificationChannel; count: number }[]>([]);

  readonly monthlyChartData = computed<IBarChartDatum[]>(() =>
    this.monthly().map((m) => ({
      label: THAI_MONTH_SHORT[Number(m.month.split('-')[1]) - 1] ?? m.month,
      value: m.count,
    })),
  );

  readonly departmentChartData = computed<IBarChartDatum[]>(() =>
    this.departmentRanking().map((d) => ({ label: d.departmentName, value: d.ticketCount })),
  );

  readonly technicianChartData = computed<IBarChartDatum[]>(() =>
    this.technicianWorkload().map((t) => ({ label: t.technicianName, value: t.openTicketCount })),
  );

  readonly assetStatusChartData = computed<IBarChartDatum[]>(() =>
    (this.summary()?.assets.byStatus ?? [])
      .slice()
      .sort((a, b) => b.count - a.count)
      .map((s) => ({ label: getStatusLabel(s.status), value: s.count, color: getStatusColor(s.status) })),
  );

  readonly topCategoryChartData = computed<IBarChartDatum[]>(() =>
    (this.analytics()?.topRepairedCategories ?? []).map((c) => ({ label: c.categoryName, value: c.repairCount })),
  );

  readonly assetActiveCount = computed(
    () => this.summary()?.assets.byStatus.find((s) => s.status === 'ACTIVE')?.count ?? 0,
  );
  readonly assetInProgressCount = computed(() =>
    (this.summary()?.assets.byStatus ?? [])
      .filter((s) => IN_PROGRESS_STATUSES.has(s.status))
      .reduce((sum, s) => sum + s.count, 0),
  );
  readonly assetOffCount = computed(() =>
    (this.summary()?.assets.byStatus ?? [])
      .filter((s) => OFF_STATUSES.has(s.status))
      .reduce((sum, s) => sum + s.count, 0),
  );

  readonly roleChartData = computed<IBarChartDatum[]>(
    () => this.userStats()?.byRole.map((r) => ({ label: r.roleNameTh, value: r.count })) ?? [],
  );
  readonly userDepartmentChartData = computed<IBarChartDatum[]>(
    () => this.userStats()?.byDepartment.map((d) => ({ label: d.departmentNameTh, value: d.count })) ?? [],
  );
  readonly positionChartData = computed<IBarChartDatum[]>(
    () => this.userStats()?.byPosition.map((p) => ({ label: p.positionNameTh, value: p.count })) ?? [],
  );

  readonly divisionsByDepartmentChartData = computed<IBarChartDatum[]>(() => {
    const counts = new Map<string, number>();
    for (const div of this.divisions()) {
      const name = div.department?.nameTh ?? 'ไม่ระบุ';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  });

  readonly roomsByDepartmentChartData = computed<IBarChartDatum[]>(() => {
    const counts = new Map<string, number>();
    for (const room of this.rooms()) {
      if (!room.department) continue;
      const name = room.department.nameTh;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  });

  readonly notifChannelChartData = computed<IBarChartDatum[]>(() =>
    this.notifByChannel()
      .filter((c) => c.count > 0)
      .map((c) => ({ label: CHANNEL_LABEL_TH[c.channel], value: c.count })),
  );

  constructor() {
    const year = new Date().getFullYear();

    this.dashboardService.getSummary().subscribe((data) => this.summary.set(data));
    this.dashboardService.getMonthlyChart(year).subscribe((data) => this.monthly.set(data));
    this.dashboardService.getDepartmentRanking(8).subscribe((data) => this.departmentRanking.set(data));
    this.dashboardService.getTechnicianWorkload().subscribe((data) => this.technicianWorkload.set(data));
    this.dashboardService.getAnalytics().subscribe((data) => {
      this.analytics.set(data);
      this.loading.set(false);
    });

    if (this.authService.hasPermission('user:read')) {
      this.userService.getStats().subscribe((stats) => this.userStats.set(stats));
    }
    if (this.authService.hasAnyPermission(['user:create', 'user:update'])) {
      this.positionService.list().subscribe((positions) => this.positions.set(positions));
    }
    if (this.authService.hasPermission('department:manage')) {
      this.departmentService.list().subscribe((departments) => this.departments.set(departments));
      this.divisionService.list().subscribe((divisions) => this.divisions.set(divisions));
    }
    if (this.authService.hasAnyPermission(['asset:create', 'asset:update'])) {
      this.locationService.listRooms().subscribe((rooms) => this.rooms.set(rooms));
    }
    if (this.authService.hasAnyPermission(['settings:manage', 'audit:view'])) {
      this.notificationService.getLogs({ limit: 1 }).subscribe((res) => this.notifTotal.set(res.meta.total));
      this.notificationService.getLogs({ limit: 1, status: 'SENT' }).subscribe((res) => this.notifSent.set(res.meta.total));
      this.notificationService.getLogs({ limit: 1, status: 'PENDING' }).subscribe((res) => this.notifPending.set(res.meta.total));
      this.notificationService.getLogs({ limit: 1, status: 'FAILED' }).subscribe((res) => this.notifFailed.set(res.meta.total));

      const channels: NotificationChannel[] = ['EMAIL', 'TELEGRAM', 'LINE', 'PUSH', 'SMS'];
      for (const channel of channels) {
        this.notificationService.getLogs({ limit: 1, channel }).subscribe((res) => {
          this.notifByChannel.update((list) => [...list.filter((c) => c.channel !== channel), { channel, count: res.meta.total }]);
        });
      }
    }
  }
}
