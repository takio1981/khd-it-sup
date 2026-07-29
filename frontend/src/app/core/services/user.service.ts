import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { resolveBackendFileUrl } from '../utils/file-url.util';
import type { IApiSuccessResponse, IPaginationMeta } from '../models/api-response.model';
import type { ICreateUserPayload, IUserListItem, IUserStats } from '../models/user.model';

export interface IUserListFilter {
  page?: number;
  limit?: number;
  roleId?: string;
  departmentId?: string;
  keyword?: string;
}

export interface IRole {
  id: string;
  code: string;
  nameTh: string;
}

export interface ITechnician {
  id: string;
  fullName: string;
  username: string;
  role: { code: string };
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/users`;

  listRoles(): Observable<IRole[]> {
    return this.http.get<IApiSuccessResponse<IRole[]>>(`${this.base}/roles`).pipe(map((res) => res.data));
  }

  listTechnicians(): Observable<ITechnician[]> {
    return this.http.get<IApiSuccessResponse<ITechnician[]>>(`${this.base}/technicians`).pipe(map((res) => res.data));
  }

  getStats(): Observable<IUserStats> {
    return this.http.get<IApiSuccessResponse<IUserStats>>(`${this.base}/stats`).pipe(map((res) => res.data));
  }

  list(filter: IUserListFilter): Observable<{ items: IUserListItem[]; meta: IPaginationMeta }> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http
      .get<IApiSuccessResponse<IUserListItem[]>>(this.base, { params })
      .pipe(map((res) => ({ items: res.data, meta: res.meta as IPaginationMeta })));
  }

  create(payload: ICreateUserPayload): Observable<IUserListItem> {
    return this.http.post<IApiSuccessResponse<IUserListItem>>(this.base, payload).pipe(map((res) => res.data));
  }

  update(id: string, payload: Partial<ICreateUserPayload> & { isActive?: boolean }): Observable<IUserListItem> {
    return this.http.patch<IApiSuccessResponse<IUserListItem>>(`${this.base}/${id}`, payload).pipe(map((res) => res.data));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<IApiSuccessResponse<unknown>>(`${this.base}/${id}`).pipe(map(() => undefined));
  }

  resetPassword(id: string): Observable<{ message: string }> {
    return this.http
      .post<IApiSuccessResponse<{ message: string }>>(`${this.base}/${id}/reset-password`, {})
      .pipe(map((res) => res.data));
  }

  uploadAvatar(id: string, file: File): Observable<IUserListItem> {
    const formData = new FormData();
    formData.append('avatar', file);
    return this.http.post<IApiSuccessResponse<IUserListItem>>(`${this.base}/${id}/avatar`, formData).pipe(map((res) => res.data));
  }

  removeAvatar(id: string): Observable<IUserListItem> {
    return this.http.delete<IApiSuccessResponse<IUserListItem>>(`${this.base}/${id}/avatar`).pipe(map((res) => res.data));
  }

  getAvatarBlob(fileUrl: string): Observable<Blob> {
    return this.http.get(resolveBackendFileUrl(fileUrl), { responseType: 'blob' });
  }
}
