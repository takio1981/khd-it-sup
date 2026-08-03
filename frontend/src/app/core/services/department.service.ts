import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { IApiSuccessResponse } from '../models/api-response.model';
import type { IDepartment } from '../models/user.model';

export interface ICreateDepartmentPayload {
  code: string;
  nameTh: string;
  nameEn?: string;
  parentId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class DepartmentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/departments`;

  list(): Observable<IDepartment[]> {
    return this.http.get<IApiSuccessResponse<IDepartment[]>>(this.base).pipe(map((res) => res.data));
  }

  create(payload: ICreateDepartmentPayload): Observable<IDepartment> {
    return this.http.post<IApiSuccessResponse<IDepartment>>(this.base, payload).pipe(map((res) => res.data));
  }

  update(id: string, payload: Partial<ICreateDepartmentPayload>): Observable<IDepartment> {
    return this.http.patch<IApiSuccessResponse<IDepartment>>(`${this.base}/${id}`, payload).pipe(map((res) => res.data));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<IApiSuccessResponse<unknown>>(`${this.base}/${id}`).pipe(map(() => undefined));
  }

  exportFile(format: 'xlsx' | 'csv'): Observable<Blob> {
    const params = new HttpParams().set('format', format);
    return this.http.get(`${this.base}/export`, { params, responseType: 'blob' });
  }
}
