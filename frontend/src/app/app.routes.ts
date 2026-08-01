import type { Routes } from '@angular/router';
import { authGuard, guestGuard, mustChangePasswordGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'auth/login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'auth/forgot-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent),
  },
  {
    path: 'auth/reset-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then((m) => m.ResetPasswordComponent),
  },
  {
    path: 'auth/change-password',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/change-password/change-password.component').then((m) => m.ChangePasswordComponent),
  },
  {
    path: 'auth/notification-channels',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/notification-channels/notification-channels.component').then((m) => m.NotificationChannelsComponent),
  },
  {
    path: 'qr/scan/:token',
    loadComponent: () => import('./features/qr/qr-scan/qr-scan.component').then((m) => m.QrScanComponent),
  },
  {
    path: 'forbidden',
    loadComponent: () => import('./features/misc/forbidden.component').then((m) => m.ForbiddenComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [mustChangePasswordGuard],
    loadComponent: () => import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        canActivate: [permissionGuard],
        data: { permissions: ['dashboard:view'], watermark: 'logo3.png' },
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'assets',
        canActivate: [permissionGuard],
        data: { permissions: ['asset:read'], watermark: 'logo3.png' },
        loadComponent: () => import('./features/assets/asset-list/asset-list.component').then((m) => m.AssetListComponent),
      },
      {
        path: 'assets/categories',
        canActivate: [permissionGuard],
        data: { permissions: ['asset:create', 'asset:update'], watermark: 'logo3.png' },
        loadComponent: () =>
          import('./features/assets/asset-category-list/asset-category-list.component').then(
            (m) => m.AssetCategoryListComponent,
          ),
      },
      {
        path: 'assets/locations',
        canActivate: [permissionGuard],
        data: { permissions: ['asset:create', 'asset:update'], watermark: 'logo3.png' },
        loadComponent: () => import('./features/locations/location-list.component').then((m) => m.LocationListComponent),
      },
      {
        path: 'asset-loans',
        canActivate: [permissionGuard],
        data: { permissions: ['asset:loan'], watermark: 'logo2.png' },
        loadComponent: () => import('./features/asset-loans/asset-loan-list.component').then((m) => m.AssetLoanListComponent),
      },
      {
        path: 'assets/:id',
        canActivate: [permissionGuard],
        data: { permissions: ['asset:read'], watermark: 'logo3.png' },
        loadComponent: () => import('./features/assets/asset-detail/asset-detail.component').then((m) => m.AssetDetailComponent),
      },
      {
        path: 'repair-tickets',
        canActivate: [permissionGuard],
        data: { permissions: ['ticket:read', 'ticket:track'], watermark: 'logo1.png' },
        loadComponent: () =>
          import('./features/repair-tickets/ticket-list/ticket-list.component').then((m) => m.TicketListComponent),
      },
      {
        path: 'repair-tickets/:id',
        canActivate: [permissionGuard],
        data: { permissions: ['ticket:read', 'ticket:track'], watermark: 'logo1.png' },
        loadComponent: () =>
          import('./features/repair-tickets/ticket-detail/ticket-detail.component').then((m) => m.TicketDetailComponent),
      },
      {
        path: 'users',
        canActivate: [permissionGuard],
        data: { permissions: ['user:read'], watermark: 'logo3.png' },
        loadComponent: () => import('./features/users/user-list/user-list.component').then((m) => m.UserListComponent),
      },
      {
        path: 'users/positions',
        canActivate: [permissionGuard],
        data: { permissions: ['user:create', 'user:update'], watermark: 'logo3.png' },
        loadComponent: () => import('./features/positions/position-list.component').then((m) => m.PositionListComponent),
      },
      {
        path: 'departments',
        canActivate: [permissionGuard],
        data: { permissions: ['department:manage'], watermark: 'logo3.png' },
        loadComponent: () =>
          import('./features/departments/department-list.component').then((m) => m.DepartmentListComponent),
      },
      {
        path: 'departments/divisions',
        canActivate: [permissionGuard],
        data: { permissions: ['department:manage'], watermark: 'logo3.png' },
        loadComponent: () => import('./features/divisions/division-list.component').then((m) => m.DivisionListComponent),
      },
      {
        path: 'settings/notifications',
        canActivate: [permissionGuard],
        data: { permissions: ['settings:manage', 'audit:view'], watermark: 'logo3.png' },
        loadComponent: () =>
          import('./features/settings/notification-settings-page/notification-settings-page.component').then(
            (m) => m.NotificationSettingsPageComponent,
          ),
      },
      {
        path: 'help',
        data: { watermark: 'logo3.png' },
        loadComponent: () => import('./features/help/help.component').then((m) => m.HelpComponent),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./features/misc/not-found.component').then((m) => m.NotFoundComponent),
  },
];
