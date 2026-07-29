import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { IApiSuccessResponse } from '../models/api-response.model';
import type {
  IAuthUser,
  ILoginRequest,
  ILoginResponse,
  INotificationChannels,
  IUpdateNotificationChannelsPayload,
  Permission,
} from '../models/auth.model';

/**
 * AuthService — เก็บ Access Token ใน memory เท่านั้น (ไม่ใช้ localStorage) เพื่อลดความเสี่ยง XSS
 * Refresh Token อยู่ใน httpOnly cookie ที่ backend ตั้งให้ (จัดการโดย browser อัตโนมัติผ่าน withCredentials)
 * ตอนโหลดแอปครั้งแรก/รีเฟรชหน้า จะเรียก refresh() เพื่อขอ access token ใหม่แบบเงียบ (silent refresh)
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _accessToken = signal<string | null>(null);
  private readonly _currentUser = signal<IAuthUser | null>(null);
  private readonly _initialized = signal(false);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);
  readonly initialized = this._initialized.asReadonly();

  getAccessToken(): string | null {
    return this._accessToken();
  }

  login(credentials: ILoginRequest): Observable<IAuthUser> {
    return this.http
      .post<IApiSuccessResponse<ILoginResponse>>(`${environment.apiBaseUrl}/auth/login`, credentials, { withCredentials: true })
      .pipe(
        tap((res) => this.setSession(res.data)),
        map((res) => res.data.user),
      );
  }

  /** เรียกตอน bootstrap แอป (provideAppInitializer) เพื่อขอ access token ใหม่จาก refresh cookie ถ้ามี */
  silentRefresh(): Observable<boolean> {
    return this.http
      .post<IApiSuccessResponse<ILoginResponse>>(`${environment.apiBaseUrl}/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        tap((res) => this.setSession(res.data)),
        map(() => true),
        catchError(() => {
          this.clearSession();
          return of(false);
        }),
        tap(() => this._initialized.set(true)),
      );
  }

  refreshAccessToken(): Observable<string> {
    return this.http
      .post<IApiSuccessResponse<ILoginResponse>>(`${environment.apiBaseUrl}/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        tap((res) => this.setSession(res.data)),
        map((res) => res.data.accessToken),
      );
  }

  changePassword(payload: { currentPassword: string; newPassword: string; confirmPassword: string }): Observable<void> {
    return this.http
      .post<IApiSuccessResponse<unknown>>(`${environment.apiBaseUrl}/auth/change-password`, payload, { withCredentials: true })
      .pipe(map(() => undefined));
  }

  getNotificationChannels(): Observable<INotificationChannels> {
    return this.http
      .get<IApiSuccessResponse<INotificationChannels>>(`${environment.apiBaseUrl}/auth/notification-channels`)
      .pipe(map((res) => res.data));
  }

  updateNotificationChannels(payload: IUpdateNotificationChannelsPayload): Observable<INotificationChannels> {
    return this.http
      .patch<IApiSuccessResponse<INotificationChannels>>(`${environment.apiBaseUrl}/auth/notification-channels`, payload)
      .pipe(map((res) => res.data));
  }

  updateMyGender(gender: 'MALE' | 'FEMALE'): Observable<IAuthUser> {
    return this.http.patch<IApiSuccessResponse<IAuthUser>>(`${environment.apiBaseUrl}/auth/profile`, { gender }).pipe(
      map((res) => res.data),
      tap((user) => this._currentUser.set(user)),
    );
  }

  uploadMyAvatar(file: File): Observable<IAuthUser> {
    const formData = new FormData();
    formData.append('avatar', file);
    return this.http.post<IApiSuccessResponse<IAuthUser>>(`${environment.apiBaseUrl}/auth/avatar`, formData).pipe(
      map((res) => res.data),
      tap((user) => this._currentUser.set(user)),
    );
  }

  removeMyAvatar(): Observable<IAuthUser> {
    return this.http.delete<IApiSuccessResponse<IAuthUser>>(`${environment.apiBaseUrl}/auth/avatar`).pipe(
      map((res) => res.data),
      tap((user) => this._currentUser.set(user)),
    );
  }

  logout(): void {
    this.http.post(`${environment.apiBaseUrl}/auth/logout`, {}, { withCredentials: true }).subscribe({
      complete: () => this.finishLogout(),
      error: () => this.finishLogout(),
    });
  }

  private finishLogout(): void {
    this.clearSession();
    void this.router.navigateByUrl('/auth/login');
  }

  private setSession(data: ILoginResponse): void {
    this._accessToken.set(data.accessToken);
    this._currentUser.set(data.user);
  }

  private clearSession(): void {
    this._accessToken.set(null);
    this._currentUser.set(null);
  }

  hasPermission(permission: Permission): boolean {
    return this._currentUser()?.permissions.includes(permission) ?? false;
  }

  hasAnyPermission(permissions: Permission[]): boolean {
    return permissions.some((p) => this.hasPermission(p));
  }
}
