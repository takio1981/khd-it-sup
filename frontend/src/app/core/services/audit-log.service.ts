import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { IApiSuccessResponse, IPaginationMeta } from '../models/api-response.model';
import type { AuditLogAction, IAuditLog } from '../models/audit-log.model';

export interface IAuditLogFilter {
  page?: number;
  limit?: number;
  module?: string;
  action?: AuditLogAction;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/audit-logs`;

  list(filter: IAuditLogFilter): Observable<{ items: IAuditLog[]; meta: IPaginationMeta }> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http
      .get<IApiSuccessResponse<IAuditLog[]>>(this.base, { params })
      .pipe(map((res) => ({ items: res.data, meta: res.meta as IPaginationMeta })));
  }

  exportFile(filter: Omit<IAuditLogFilter, 'page' | 'limit'>, format: 'xlsx' | 'csv'): Observable<Blob> {
    let params = new HttpParams().set('format', format);
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    }
    return this.http.get(`${this.base}/export`, { params, responseType: 'blob' });
  }
}
