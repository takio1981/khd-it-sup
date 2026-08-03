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
    });
  }

  refreshMyNotifications(): void {
    this.http
      .get<IApiSuccessResponse<IInAppNotification[]>>(`${this.base}/me`, { params: { limit: String(BELL_LIST_LIMIT) } })
      .subscribe((res) => this.items.set(res.data));
  }

  refreshUnreadCount(): void {
    this.http.get<IApiSuccessResponse<{ count: number }>>(`${this.base}/me/unread-count`).subscribe((res) => this.unreadCount.set(res.data.count));
  }

  markAsRead(id: string): void {
    const target = this.items().find((n) => n.id === id);
    if (!target || target.readAt) return;

    this.http.patch<IApiSuccessResponse<{ message: string }>>(`${this.base}/me/${id}/read`, {}).subscribe(() => {
      const readAt = new Date().toISOString();
      this.items.update((list) => list.map((n) => (n.id === id ? { ...n, readAt } : n)));
      this.unreadCount.update((n) => Math.max(0, n - 1));
    });
  }

  markAllAsRead(): void {
    this.http.patch<IApiSuccessResponse<{ message: string }>>(`${this.base}/me/read-all`, {}).subscribe(() => {
      const readAt = new Date().toISOString();
      this.items.update((list) => list.map((n) => ({ ...n, readAt: n.readAt ?? readAt })));
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
