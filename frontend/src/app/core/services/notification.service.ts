import { Injectable, effect, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { SocketService } from './socket.service';
import type { IApiSuccessResponse, IPaginationMeta } from '../models/api-response.model';
import type { IInAppNotification, INotificationLog, NotificationChannel, NotificationStatus } from '../models/notification.model';

export interface INotificationLogFilter {
  page?: number;
  limit?: number;
  channel?: NotificationChannel;
  status?: NotificationStatus;
}

const BELL_LIST_LIMIT = 20;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly socketService = inject(SocketService);
  private readonly base = `${environment.apiBaseUrl}/notifications`;

  /** แจ้งเตือนในแอป (bell) ล่าสุดของผู้ใช้ปัจจุบัน */
  readonly items = signal<IInAppNotification[]>([]);
  readonly unreadCount = signal(0);

  constructor() {
    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.refreshUnreadCount();
        this.refreshMyNotifications();
        this.requestNativeNotificationPermission();
      } else {
        this.items.set([]);
        this.unreadCount.set(0);
      }
    });

    this.socketService.notification$.subscribe((payload) => {
      const item: IInAppNotification = {
        id: payload.id,
        subject: payload.title,
        message: payload.message,
        relatedEntityType: payload.relatedEntityType,
        relatedEntityId: payload.relatedEntityId,
        readAt: null,
        createdAt: payload.createdAt,
      };
      this.items.update((list) => [item, ...list].slice(0, BELL_LIST_LIMIT));
      this.unreadCount.update((n) => n + 1);
      this.showNativeNotification(payload.title, payload.message);
    });
  }

  /** ขอสิทธิ์แจ้งเตือนของเบราว์เซอร์/OS (เช่น Windows Action Center) ครั้งเดียวหลัง login — ถ้าผู้ใช้เคยตอบแล้ว (granted/denied) จะไม่ถามซ้ำ */
  private requestNativeNotificationPermission(): void {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }

  /** แจ้งเตือนแบบ native ของเบราว์เซอร์/OS เมื่อมีแจ้งเตือนใหม่เข้ามาแบบ real-time — แสดงเฉพาะตอนที่ผู้ใช้ไม่ได้โฟกัสแท็บนี้อยู่
   *  (ถ้ากำลังดูอยู่แล้วกระดิ่งก็อัปเดตให้เห็นทันที ไม่จำเป็นต้อง popup ซ้ำ) */
  private showNativeNotification(title: string, body: string): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible' && document.hasFocus()) return;

    const notification = new Notification(title, { body, icon: 'icons/icon-192.png', tag: 'khd-it-sup-notification' });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }

  /** ดึงเฉพาะแจ้งเตือนที่ยังไม่ได้อ่าน — กระดิ่งแสดงเฉพาะรายการที่ยังไม่อ่านเท่านั้น ไม่ปนรายการที่อ่านแล้ว */
  refreshMyNotifications(): void {
    this.http
      .get<IApiSuccessResponse<IInAppNotification[]>>(`${this.base}/me`, {
        params: { limit: String(BELL_LIST_LIMIT), unreadOnly: 'true' },
      })
      .subscribe((res) => this.items.set(res.data));
  }

  refreshUnreadCount(): void {
    this.http.get<IApiSuccessResponse<{ count: number }>>(`${this.base}/me/unread-count`).subscribe((res) => this.unreadCount.set(res.data.count));
  }

  /** อ่านแล้วต้องหายจากกระดิ่งทันที เพราะรายการในกระดิ่งแสดงเฉพาะที่ยังไม่ได้อ่านเท่านั้น */
  markAsRead(id: string): void {
    const target = this.items().find((n) => n.id === id);
    if (!target || target.readAt) return;

    this.http.patch<IApiSuccessResponse<{ message: string }>>(`${this.base}/me/${id}/read`, {}).subscribe(() => {
      this.items.update((list) => list.filter((n) => n.id !== id));
      this.unreadCount.update((n) => Math.max(0, n - 1));
    });
  }

  markAllAsRead(): void {
    this.http.patch<IApiSuccessResponse<{ message: string }>>(`${this.base}/me/read-all`, {}).subscribe(() => {
      this.items.set([]);
      this.unreadCount.set(0);
    });
  }

  getLogs(filter: INotificationLogFilter): Observable<{ items: INotificationLog[]; meta: IPaginationMeta }> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http
      .get<IApiSuccessResponse<INotificationLog[]>>(`${this.base}/logs`, { params })
      .pipe(map((res) => ({ items: res.data, meta: res.meta as IPaginationMeta })));
  }

  exportLogsFile(filter: Omit<INotificationLogFilter, 'page' | 'limit'>, format: 'xlsx' | 'csv'): Observable<Blob> {
    let params = new HttpParams().set('format', format);
    for (const [key, value] of Object.entries(filter) as [string, unknown][]) {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    }
    return this.http.get(`${this.base}/logs/export`, { params, responseType: 'blob' });
  }
}
