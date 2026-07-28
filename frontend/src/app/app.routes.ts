import type { Routes } from '@angular/router';
import { authGuard, guestGuard, mustChangePasswordGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  {
    path: 'auth/login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
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
        data: { permissions: ['dashboard:view'] },
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'assets',
        canActivate: [permissionGuard],
        data: { permissions: ['asset:read'] },
        loadComponent: () => import('./features/assets/asset-list/asset-list.component').then((m) => m.AssetListComponent),
      },
      {
        path: 'assets/categories',
        canActivate: [permissionGuard],
        data: { permissions: ['asset:create', 'asset:update'] },
        loadComponent: () =>
          import('./features/assets/asset-category-list/asset-category-list.component').then(
            (m) => m.AssetCategoryListComponent,
          ),
      },
      {
        path: 'assets/locations',
        canActivate: [permissionGuard],
        data: { permissions: ['asset:create', 'asset:update'] },
        loadComponent: () => import('./features/locations/location-list.component').then((m) => m.LocationListComponent),
      },
      {
        path: 'asset-loans',
        canActivate: [permissionGuard],
        data: { permissions: ['asset:loan'] },
        loadComponent: () => import('./features/asset-loans/asset-loan-list.component').then((m) => m.AssetLoanListComponent),
      },
      {
        path: 'assets/:id',
        canActivate: [permissionGuard],
        data: { permissions: ['asset:read'] },
        loadComponent: () => import('./features/assets/asset-detail/asset-detail.component').then((m) => m.AssetDetailComponent),
      },
      {
        path: 'repair-tickets',
        canActivate: [permissionGuard],
        data: { permissions: ['ticket:read', 'ticket:track'] },
        loadComponent: () =>
          import('./features/repair-tickets/ticket-list/ticket-list.component').then((m) => m.TicketListComponent),
      },
      {
        path: 'repair-tickets/:id',
        canActivate: [permissionGuard],
        data: { permissions: ['ticket:read', 'ticket:track'] },
        loadComponent: () =>
          import('./features/repair-tickets/ticket-detail/ticket-detail.component').then((m) => m.TicketDetailComponent),
      },
      {
        path: 'users',
        canActivate: [permissionGuard],
        data: { permissions: ['user:read'] },
        loadComponent: () => import('./features/users/user-list/user-list.component').then((m) => m.UserListComponent),
      },
      {
        path: 'users/positions',
        canActivate: [permissionGuard],
        data: { permissions: ['user:create', 'user:update'] },
        loadComponent: () => import('./features/positions/position-list.component').then((m) => m.PositionListComponent),
      },
      {
        path: 'departments',
        canActivate: [permissionGuard],
        data: { permissions: ['department:manage'] },
        loadComponent: () =>
          import('./features/departments/department-list.component').then((m) => m.DepartmentListComponent),
      },
      {
        path: 'departments/divisions',
        canActivate: [permissionGuard],
        data: { permissions: ['department:manage'] },
        loadComponent: () => import('./features/divisions/division-list.component').then((m) => m.DivisionListComponent),
      },
      {
        path: 'settings/notifications',
        canActivate: [permissionGuard],
        data: { permissions: ['settings:manage', 'audit:view'] },
        loadComponent: () =>
          import('./features/settings/notification-settings-page/notification-settings-page.component').then(
            (m) => m.NotificationSettingsPageComponent,
          ),
      },
      {
        path: 'help',
        loadComponent: () => import('./features/help/help.component').then((m) => m.HelpComponent),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./features/misc/not-found.component').then((m) => m.NotFoundComponent),
  },
];
