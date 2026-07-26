import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { IApiSuccessResponse } from '../models/api-response.model';
import type { IDivision } from '../models/user.model';

export interface ICreateDivisionPayload {
  code: string;
  nameTh: string;
  nameEn?: string;
  departmentId: string;
}

@Injectable({ providedIn: 'root' })
export class DivisionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/divisions`;

  list(): Observable<IDivision[]> {
    return this.http.get<IApiSuccessResponse<IDivision[]>>(this.base).pipe(map((res) => res.data));
  }

  create(payload: ICreateDivisionPayload): Observable<IDivision> {
    return this.http.post<IApiSuccessResponse<IDivision>>(this.base, payload).pipe(map((res) => res.data));
  }

  update(id: string, payload: Partial<ICreateDivisionPayload>): Observable<IDivision> {
    return this.http.patch<IApiSuccessResponse<IDivision>>(`${this.base}/${id}`, payload).pipe(map((res) => res.data));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<IApiSuccessResponse<unknown>>(`${this.base}/${id}`).pipe(map(() => undefined));
  }
}
