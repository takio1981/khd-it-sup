import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { PageWatermarkComponent } from '../../shared/components/page-watermark/page-watermark.component';
import { NAV_ITEMS } from '../nav-items';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'khd-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatMenuModule,
    MatButtonModule,
    MatDividerModule,
    MatTooltipModule,
    IconComponent,
    PageWatermarkComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  readonly orgName = environment.orgNameTh;
  readonly appName = environment.appName;

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

  logout(): void {
    this.authService.logout();
  }

  private deepestRouteWatermark(): string | undefined {
    let route = this.activatedRoute.snapshot;
    while (route.firstChild) route = route.firstChild;
    return route.data['watermark'] as string | undefined;
  }
}
