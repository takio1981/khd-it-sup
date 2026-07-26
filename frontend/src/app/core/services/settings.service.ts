import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { IApiSuccessResponse } from '../models/api-response.model';
import type { INotificationSettings, IUpdateNotificationSettingsPayload } from '../models/settings.model';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/settings`;

  getNotificationSettings(): Observable<INotificationSettings> {
    return this.http
      .get<IApiSuccessResponse<INotificationSettings>>(`${this.base}/notifications`)
      .pipe(map((res) => res.data));
  }

  updateNotificationSettings(payload: IUpdateNotificationSettingsPayload): Observable<INotificationSettings> {
    return this.http
      .patch<IApiSuccessResponse<INotificationSettings>>(`${this.base}/notifications`, payload)
      .pipe(map((res) => res.data));
  }
}
