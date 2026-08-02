import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { resolveBackendFileUrl } from '../utils/file-url.util';
import type { IApiSuccessResponse } from '../models/api-response.model';
import type {
  IBranding,
  INotificationSettings,
  IOrgSettings,
  IUpdateNotificationSettingsPayload,
  IUpdateOrgSettingsPayload,
} from '../models/settings.model';

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

  getOrgSettings(): Observable<IOrgSettings> {
    return this.http.get<IApiSuccessResponse<IOrgSettings>>(`${this.base}/org`).pipe(map((res) => res.data));
  }

  getBranding(): Observable<IBranding> {
    return this.http.get<IApiSuccessResponse<IBranding>>(`${this.base}/branding`).pipe(map((res) => res.data));
  }

  updateOrgSettings(payload: IUpdateOrgSettingsPayload): Observable<IOrgSettings> {
    return this.http.patch<IApiSuccessResponse<IOrgSettings>>(`${this.base}/org`, payload).pipe(map((res) => res.data));
  }

  uploadOrgLogo(file: File): Observable<IOrgSettings> {
    const formData = new FormData();
    formData.append('logo', file);
    return this.http.post<IApiSuccessResponse<IOrgSettings>>(`${this.base}/org/logo`, formData).pipe(map((res) => res.data));
  }

  removeOrgLogo(): Observable<IOrgSettings> {
    return this.http.delete<IApiSuccessResponse<IOrgSettings>>(`${this.base}/org/logo`).pipe(map((res) => res.data));
  }

  getLogoBlob(fileUrl: string): Observable<Blob> {
    return this.http.get(resolveBackendFileUrl(fileUrl), { responseType: 'blob' });
  }
}
