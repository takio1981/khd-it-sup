import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { IApiSuccessResponse, IPaginationMeta } from '../models/api-response.model';
import type { INotificationLog, NotificationChannel, NotificationStatus } from '../models/notification.model';

export interface INotificationLogFilter {
  page?: number;
  limit?: number;
  channel?: NotificationChannel;
  status?: NotificationStatus;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/notifications`;

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
}
