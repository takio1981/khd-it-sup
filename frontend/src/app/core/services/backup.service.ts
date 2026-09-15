import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { IApiSuccessResponse, IPaginationMeta } from '../models/api-response.model';
import type {
  BackupAction,
  BackupType,
  IBackupLog,
  IBackupSettings,
  IBackupStatus,
  IBackupTableGroup,
  IRestorePayload,
  IRunBackupPayload,
  IUpdateBackupSettingsPayload,
  BackupLogStatus,
} from '../models/backup.model';

export interface IBackupLogFilter {
  page?: number;
  limit?: number;
  action?: BackupAction;
  type?: BackupType;
  status?: BackupLogStatus;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/backup`;

  getTables(): Observable<IBackupTableGroup[]> {
    return this.http.get<IApiSuccessResponse<IBackupTableGroup[]>>(`${this.base}/tables`).pipe(map((res) => res.data));
  }

  getStatus(): Observable<IBackupStatus> {
    return this.http.get<IApiSuccessResponse<IBackupStatus>>(`${this.base}/status`).pipe(map((res) => res.data));
  }

  list(filter: IBackupLogFilter): Observable<{ items: IBackupLog[]; meta: IPaginationMeta }> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http
      .get<IApiSuccessResponse<IBackupLog[]>>(this.base, { params })
      .pipe(map((res) => ({ items: res.data, meta: res.meta as IPaginationMeta })));
  }

  runBackup(payload: IRunBackupPayload): Observable<{ started: true }> {
    return this.http.post<IApiSuccessResponse<{ started: true }>>(`${this.base}/run`, payload).pipe(map((res) => res.data));
  }

  download(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/download`, { responseType: 'blob' });
  }

  deleteBackup(id: string): Observable<void> {
    return this.http.delete<IApiSuccessResponse<unknown>>(`${this.base}/${id}`).pipe(map(() => undefined));
  }

  restore(id: string, payload: IRestorePayload): Observable<{ started: true }> {
    return this.http.post<IApiSuccessResponse<{ started: true }>>(`${this.base}/${id}/restore`, payload).pipe(map((res) => res.data));
  }

  getSettings(): Observable<IBackupSettings> {
    return this.http.get<IApiSuccessResponse<IBackupSettings>>(`${this.base}/settings`).pipe(map((res) => res.data));
  }

  updateSettings(payload: IUpdateBackupSettingsPayload): Observable<IBackupSettings> {
    return this.http.patch<IApiSuccessResponse<IBackupSettings>>(`${this.base}/settings`, payload).pipe(map((res) => res.data));
  }
}
