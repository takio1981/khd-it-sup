import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { NotificationService } from '../../core/services/notification.service';
import { SettingsService } from '../../core/services/settings.service';
import { RepairTicketService } from '../../core/services/repair-ticket.service';
import { SocketService } from '../../core/services/socket.service';
import { STAFF_ROLES } from '../../core/models/auth.model';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { PageWatermarkComponent } from '../../shared/components/page-watermark/page-watermark.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';
import { ProfileDialogComponent } from '../../shared/components/profile-dialog/profile-dialog.component';
import { GlobalSearchDialogComponent } from '../../shared/components/global-search-dialog/global-search-dialog.component';
import { NAV_ITEMS } from '../nav-items';
import { environment } from '../../../environments/environment';
import type { IInAppNotification } from '../../core/models/notification.model';

@Component({
  selector: 'khd-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    DatePipe,
    NgTemplateOutlet,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatMenuModule,
    MatButtonModule,
    MatDividerModule,
    MatTooltipModule,
    IconComponent,
    PageWatermarkComponent,
    UserAvatarComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly settingsService = inject(SettingsService);
  private readonly repairTicketService = inject(RepairTicketService);
  private readonly socketService = inject(SocketService);
  private readonly destroyRef = inject(DestroyRef);

  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  readonly notificationService = inject(NotificationService);
  readonly appName = environment.appName;

  /** เห็นตัวเลขงานแจ้งซ่อมใหม่ที่เมนู sidebar เฉพาะ role เจ้าหน้าที่ — ผู้แจ้งซ่อมทั่วไปไม่ควรเห็นตัวเลขรวมทั้งระบบ */
  readonly isStaffRole = computed(() => {
    const role = this.authService.currentUser()?.role;
    return !!role && STAFF_ROLES.includes(role);
  });
  readonly unviewedTicketCount = signal(0);

  /** ชื่อองค์กร/โลโก้ — โหลดจาก "ตั้งค่าทั่วไป" (ถ้าแอดมินยังไม่ได้ตั้งค่า ใช้ค่า default จาก environment/logo1.png แทน) */
  private readonly orgNameFromSettings = signal<string | null>(null);
  readonly orgName = computed(() => this.orgNameFromSettings() || environment.orgNameTh);
  readonly logoObjectUrl = signal<string | null>(null);

  constructor() {
    this.settingsService.getBranding().subscribe((b) => {
      this.orgNameFromSettings.set(b.orgNameTh || null);
      if (b.orgLogoUrl) {
        this.settingsService.getLogoBlob(b.orgLogoUrl).subscribe((blob) => this.logoObjectUrl.set(URL.createObjectURL(blob)));
      }
    });

    this.destroyRef.onDestroy(() => {
      const url = this.logoObjectUrl();
      if (url) URL.revokeObjectURL(url);
    });

    if (this.isStaffRole()) {
      this.repairTicketService.getUnviewedCount().subscribe((count) => this.unviewedTicketCount.set(count));
    }

    // งานแจ้งซ่อมใหม่เข้ามา/มีคนเข้าดูเป็นคนแรก — อัปเดตตัวเลขที่เมนูสด (backend ส่ง event นี้ให้เฉพาะ role เจ้าหน้าที่อยู่แล้ว)
    this.socketService.ticketCreated$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.unviewedTicketCount.update((v) => v + 1);
    });
    this.socketService.ticketViewed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.unviewedTicketCount.update((v) => Math.max(0, v - 1));
    });
  }

  readonly isMobile = toSignal(
    this.breakpointObserver.observe('(max-width: 768px)').pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  /** ภาพลายน้ำพื้นหลังของหน้าปัจจุบัน — อ่านจาก route data ของ child route ที่ลึกที่สุด (ดู watermark ใน app.routes.ts) */
  readonly watermarkSrc = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.deepestRouteWatermark()),
      startWith(this.deepestRouteWatermark()),
    ),
    { requireSync: true },
  );

  /** มือถือ: เปิด/ปิด sidenav แบบ overlay ทั้งแผง */
  readonly sidenavOpened = signal(true);
  /** เดสก์ท็อป: "ซ่อนเมนู" ไม่ได้ซ่อนแผงทั้งหมดแล้ว แต่ย่อเหลือแค่แถบไอคอน (ยังเห็นป้ายแจ้งเตือนงานแจ้งซ่อมบนไอคอนอยู่) */
  readonly sidebarCollapsed = signal(false);
  readonly isSidebarExpanded = computed(() => (this.isMobile() ? this.sidenavOpened() : !this.sidebarCollapsed()));

  readonly navItems = computed(() =>
    NAV_ITEMS.filter((item) => !item.permissions?.length || this.authService.hasAnyPermission(item.permissions)),
  );

  toggleSidenav(): void {
    if (this.isMobile()) {
      this.sidenavOpened.update((v) => !v);
    } else {
      this.sidebarCollapsed.update((v) => !v);
    }
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  openProfileDialog(): void {
    this.dialog.open(ProfileDialogComponent, { width: '380px' });
  }

  openSearch(): void {
    this.dialog.open(GlobalSearchDialogComponent, { width: '640px', maxWidth: '92vw', autoFocus: true, panelClass: 'khd-search-dialog-panel' });
  }

  logout(): void {
    this.authService.logout();
  }

  onNotificationClick(notification: IInAppNotification): void {
    if (!notification.readAt) this.notificationService.markAsRead(notification.id);

    const link = this.resolveNotificationLink(notification);
    if (link) void this.router.navigateByUrl(link);
  }

  private resolveNotificationLink(notification: IInAppNotification): string | null {
    if (notification.relatedEntityType === 'RepairTicket' && notification.relatedEntityId) {
      return `/repair-tickets/${notification.relatedEntityId}`;
    }
    if (notification.relatedEntityType === 'AssetLoan') {
      return '/asset-loans';
    }
    return null;
  }

  private deepestRouteWatermark(): string | undefined {
    let route = this.activatedRoute.snapshot;
    while (route.firstChild) route = route.firstChild;
    return route.data['watermark'] as string | undefined;
  }
}
