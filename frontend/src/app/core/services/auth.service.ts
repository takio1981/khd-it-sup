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
  IPinDevice,
  IPinLoginMarker,
  IPinLoginRequest,
  IPinSetupRequest,
  IPinSetupResponse,
  IPinStatusResponse,
  IUpdateNotificationChannelsPayload,
  Permission,
} from '../models/auth.model';

const PIN_LOGIN_MARKER_KEY = 'khd_pin_login_marker';

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

  forgotPassword(usernameOrEmail: string): Observable<{ message: string }> {
    return this.http
      .post<IApiSuccessResponse<{ message: string }>>(`${environment.apiBaseUrl}/auth/forgot-password`, { usernameOrEmail })
      .pipe(map((res) => res.data));
  }

  resetPassword(payload: { token: string; newPassword: string; confirmPassword: string }): Observable<{ message: string }> {
    return this.http
      .post<IApiSuccessResponse<{ message: string }>>(`${environment.apiBaseUrl}/auth/reset-password`, payload)
      .pipe(map((res) => res.data));
  }

  /** ตั้งค่า/ตั้งใหม่ PIN สำหรับอุปกรณ์นี้ — ต้องเข้าสู่ระบบอยู่แล้ว (ยืนยันรหัสผ่านซ้ำในตัว payload) */
  setupPin(payload: IPinSetupRequest): Observable<IPinSetupResponse> {
    return this.http
      .post<IApiSuccessResponse<IPinSetupResponse>>(`${environment.apiBaseUrl}/auth/pin/setup`, payload, { withCredentials: true })
      .pipe(
        map((res) => res.data),
        tap(() => {
          const user = this._currentUser();
          if (user) this.setPinLoginMarker({ username: user.username, fullName: user.fullName, gender: user.gender });
        }),
      );
  }

  /**
   * ตรวจสอบกับ server ว่าอุปกรณ์นี้มี PIN ใช้งานได้จริงหรือไม่ — เป็นแหล่งความจริงที่หน้า login ควรใช้ตัดสินใจ
   * แสดงหน้ากรอก PIN หรือฟอร์มรหัสผ่าน แทนการเชื่อ localStorage marker เพียงอย่างเดียว (marker อาจไม่ตรงกับ
   * ความจริงได้ เช่น cookie ถูกล้างไปแล้วแต่ marker ยังอยู่ หรือ PIN ถูกยกเลิกจากอุปกรณ์อื่น)
   */
  getPinStatus(): Observable<IPinStatusResponse> {
    return this.http
      .get<IApiSuccessResponse<IPinStatusResponse>>(`${environment.apiBaseUrl}/auth/pin/status`, { withCredentials: true })
      .pipe(map((res) => res.data));
  }

  /** เข้าสู่ระบบด้วย PIN — ใช้ได้เฉพาะอุปกรณ์ที่เคยตั้งค่า PIN ไว้แล้ว (ยืนยันผ่าน httpOnly cookie ไม่ใช่ token) */
  loginWithPin(payload: IPinLoginRequest): Observable<IAuthUser> {
    return this.http
      .post<IApiSuccessResponse<ILoginResponse>>(`${environment.apiBaseUrl}/auth/pin/login`, payload, { withCredentials: true })
      .pipe(
        tap((res) => this.setSession(res.data)),
        map((res) => res.data.user),
      );
  }

  listPinDevices(): Observable<IPinDevice[]> {
    return this.http
      .get<IApiSuccessResponse<IPinDevice[]>>(`${environment.apiBaseUrl}/auth/pin/devices`, { withCredentials: true })
      .pipe(map((res) => res.data));
  }

  revokePinDevice(id: string): Observable<void> {
    return this.http
      .delete<IApiSuccessResponse<unknown>>(`${environment.apiBaseUrl}/auth/pin/devices/${id}`, { withCredentials: true })
      .pipe(map(() => undefined));
  }

  disablePin(): Observable<void> {
    return this.http.post<IApiSuccessResponse<unknown>>(`${environment.apiBaseUrl}/auth/pin/disable`, {}, { withCredentials: true }).pipe(
      map(() => undefined),
      tap(() => this.clearPinLoginMarker()),
    );
  }

  /** ปิดใช้งาน PIN เฉพาะเครื่องนี้ — ใช้กับสวิตช์เปิด/ปิด PIN ที่หน้าตั้งค่า PIN ไม่ต้องรู้ device id ล่วงหน้า */
  disableCurrentDevicePin(): Observable<void> {
    return this.http
      .post<IApiSuccessResponse<unknown>>(`${environment.apiBaseUrl}/auth/pin/revoke-current`, {}, { withCredentials: true })
      .pipe(
        map(() => undefined),
        tap(() => this.clearPinLoginMarker()),
      );
  }

  /**
   * Marker ฝั่ง client เก็บ username/fullName/gender ไว้ทักทายผู้ใช้บนหน้ากรอก PIN เท่านั้น ไม่มี
   * PIN/token/secret ใดๆ — ตัวยืนยันตัวตนจริงคือ httpOnly cookie ที่ JS อ่านไม่ได้ ต่อให้ localStorage
   * ถูกอ่านก็ล็อกอินด้วย PIN ไม่ได้ถ้าไม่มี cookie คู่กัน แหล่งความจริงว่าจะแสดงหน้า PIN หรือไม่คือ
   * getPinStatus() (เช็คกับ server) ไม่ใช่การเช็คว่า marker นี้มีอยู่หรือเปล่า
   */
  getPinLoginMarker(): IPinLoginMarker | null {
    try {
      const raw = localStorage.getItem(PIN_LOGIN_MARKER_KEY);
      return raw ? (JSON.parse(raw) as IPinLoginMarker) : null;
    } catch {
      return null;
    }
  }

  setPinLoginMarker(marker: IPinLoginMarker): void {
    try {
      localStorage.setItem(PIN_LOGIN_MARKER_KEY, JSON.stringify(marker));
    } catch {
      // localStorage ไม่พร้อมใช้งาน (private mode ฯลฯ) — ข้ามไป ผู้ใช้จะเห็นฟอร์มรหัสผ่านแทน
    }
  }

  clearPinLoginMarker(): void {
    try {
      localStorage.removeItem(PIN_LOGIN_MARKER_KEY);
    } catch {
      // เพิกเฉย
    }
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
