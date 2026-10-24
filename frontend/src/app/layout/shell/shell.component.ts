import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatDialog } from '@angular/material/dialog';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { NotificationService } from '../../core/services/notification.service';
import { SettingsService } from '../../core/services/settings.service';
import { RepairTicketService } from '../../core/services/repair-ticket.service';
import { SocketService } from '../../core/services/socket.service';
import { ROLE_LABEL_TH, STAFF_ROLES } from '../../core/models/auth.model';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';
import { ProfileDialogComponent } from '../../shared/components/profile-dialog/profile-dialog.component';
import { GlobalSearchDialogComponent } from '../../shared/components/global-search-dialog/global-search-dialog.component';
import { TicketFormComponent } from '../../features/repair-tickets/ticket-form/ticket-form.component';
import { ACCOUNT_NAV_GROUP, NAV_GROUPS, type INavItem } from '../nav-items';
import { environment } from '../../../environments/environment';
import type { IInAppNotification } from '../../core/models/notification.model';

const COLLAPSED_KEY = 'khd-sidebar-collapsed';

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
    MatMenuModule,
    MatButtonModule,
    MatDividerModule,
    MatTooltipModule,
    IconComponent,
    UserAvatarComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly settingsService = inject(SettingsService);
  private readonly repairTicketService = inject(RepairTicketService);
  private readonly socketService = inject(SocketService);
  private readonly destroyRef = inject(DestroyRef);

  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  readonly notificationService = inject(NotificationService);
  readonly appName = environment.appName;

  /** เห็นตัวเลขงานแจ้งซ่อมใหม่ที่เมนูเฉพาะ role เจ้าหน้าที่ — ผู้แจ้งซ่อมทั่วไปไม่ควรเห็นตัวเลขรวมทั้งระบบ */
  readonly isStaffRole = computed(() => {
    const role = this.authService.currentUser()?.role;
    return !!role && STAFF_ROLES.includes(role);
  });
  readonly roleLabel = computed(() => {
    const role = this.authService.currentUser()?.role;
    return role ? ROLE_LABEL_TH[role] : '';
  });
  readonly unviewedTicketCount = signal(0);
  readonly canCreateTicket = computed(() => !!this.authService.currentUser() && this.authService.hasAnyPermission(['ticket:create']));

  /** ชื่อองค์กร/โลโก้ — โหลดจาก "ตั้งค่าทั่วไป" (ถ้าแอดมินยังไม่ได้ตั้งค่า ใช้ค่า default จาก environment/logo1.png แทน) */
  private readonly orgNameFromSettings = signal<string | null>(null);
  readonly orgName = computed(() => this.orgNameFromSettings() || environment.orgNameTh);
  readonly logoObjectUrl = signal<string | null>(null);

  readonly isMobile = toSignal(this.breakpointObserver.observe('(max-width: 768px)').pipe(map((r) => r.matches)), {
    initialValue: false,
  });

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { requireSync: true },
  );

  /** มือถือ: เปิด/ปิด sidenav แบบ overlay — เริ่มต้นปิด (เดิมเปิดค้างบังเนื้อหาทุกครั้งที่โหลดหน้า) */
  readonly sidenavOpened = signal(false);
  /** เดสก์ท็อป: ย่อเหลือแถบไอคอน — จำค่าไว้ในเบราว์เซอร์ */
  readonly sidebarCollapsed = signal(readCollapsed());
  readonly isSidebarExpanded = computed(() => (this.isMobile() ? this.sidenavOpened() : !this.sidebarCollapsed()));

  private readonly allowed = (item: INavItem) =>
    !item.permissions?.length || this.authService.hasAnyPermission(item.permissions);

  readonly navGroups = computed(() =>
    NAV_GROUPS.map((g) => ({ label: g.label, items: g.items.filter(this.allowed) })).filter((g) => g.items.length > 0),
  );

  /** ชื่อหน้าปัจจุบันใน top bar — จับคู่ route ที่ยาวที่สุดที่ขึ้นต้นตรงกับ URL (หน้ารายละเอียดใช้ชื่อเมนูแม่) */
  readonly currentNav = computed(() => {
    const path = this.currentUrl().split(/[?#]/)[0];
    let best: { label: string; group: string; len: number } | null = null;
    for (const g of [...NAV_GROUPS, ACCOUNT_NAV_GROUP]) {
      for (const item of g.items) {
        if ((path === item.route || path.startsWith(item.route + '/')) && (!best || item.route.length > best.len)) {
          best = { label: item.label, group: g.label, len: item.route.length };
        }
      }
    }
    return best;
  });

  private readonly bottomItems = computed(() =>
    this.navGroups()
      .flatMap((g) => g.items)
      .filter((i) => i.mobile)
      .slice(0, 3),
  );
  readonly bottomNavLeft = computed(() => this.bottomItems().slice(0, 2));
  readonly bottomNavRight = computed(() => this.bottomItems().slice(2));

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

    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (this.isMobile()) this.sidenavOpened.set(false);
      });
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (this.dialog.openDialogs.length === 0) this.openSearch();
    }
  }

  hasTicketBadge(route: string): boolean {
    return route === '/repair-tickets' && this.isStaffRole() && this.unviewedTicketCount() > 0;
  }

  toggleSidenav(): void {
    if (this.isMobile()) {
      this.sidenavOpened.update((v) => !v);
      return;
    }
    this.sidebarCollapsed.update((v) => !v);
    try {
      localStorage.setItem(COLLAPSED_KEY, this.sidebarCollapsed() ? '1' : '0');
    } catch {
      // ไม่มี storage ก็แค่ไม่จำค่า
    }
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  openProfileDialog(): void {
    this.dialog.open(ProfileDialogComponent, { width: '380px', maxWidth: '95vw' });
  }

  openSearch(): void {
    this.dialog.open(GlobalSearchDialogComponent, { width: '640px', maxWidth: '92vw', autoFocus: true, panelClass: 'khd-search-dialog-panel' });
  }

  openCreateTicket(): void {
    const ref = this.dialog.open(TicketFormComponent, { width: '560px', maxWidth: '95vw' });
    ref.afterClosed().subscribe((ticket) => {
      if (ticket) void this.router.navigate(['/repair-tickets', ticket.id]);
    });
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
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}
