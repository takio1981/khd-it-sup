import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { IApiSuccessResponse } from '../models/api-response.model';
import type { IPosition } from '../models/user.model';

export interface ICreatePositionPayload {
  code: string;
  nameTh: string;
  nameEn?: string;
}

@Injectable({ providedIn: 'root' })
export class PositionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/positions`;

  list(): Observable<IPosition[]> {
    return this.http.get<IApiSuccessResponse<IPosition[]>>(this.base).pipe(map((res) => res.data));
  }

  create(payload: ICreatePositionPayload): Observable<IPosition> {
    return this.http.post<IApiSuccessResponse<IPosition>>(this.base, payload).pipe(map((res) => res.data));
  }

  update(id: string, payload: Partial<ICreatePositionPayload>): Observable<IPosition> {
    return this.http.patch<IApiSuccessResponse<IPosition>>(`${this.base}/${id}`, payload).pipe(map((res) => res.data));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<IApiSuccessResponse<unknown>>(`${this.base}/${id}`).pipe(map(() => undefined));
  }
}
