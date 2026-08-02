import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DatePipe } from '@angular/common';
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
import { IconComponent } from '../../shared/components/icon/icon.component';
import { PageWatermarkComponent } from '../../shared/components/page-watermark/page-watermark.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';
import { ProfileDialogComponent } from '../../shared/components/profile-dialog/profile-dialog.component';
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
  private readonly destroyRef = inject(DestroyRef);

  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  readonly notificationService = inject(NotificationService);
  readonly appName = environment.appName;

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

  readonly sidenavOpened = signal(true);

  readonly navItems = computed(() =>
    NAV_ITEMS.filter((item) => !item.permissions?.length || this.authService.hasAnyPermission(item.permissions)),
  );

  toggleSidenav(): void {
    this.sidenavOpened.update((v) => !v);
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  openProfileDialog(): void {
    this.dialog.open(ProfileDialogComponent, { width: '380px' });
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
