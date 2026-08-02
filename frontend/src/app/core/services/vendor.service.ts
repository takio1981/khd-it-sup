import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { IApiSuccessResponse, IPaginationMeta } from '../models/api-response.model';
import type { ICreateVendorPayload, IUpdateVendorPayload, IVendor } from '../models/vendor.model';

export interface IVendorListFilter {
  page?: number;
  limit?: number;
  keyword?: string;
  activeOnly?: boolean;
}

@Injectable({ providedIn: 'root' })
export class VendorService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/vendors`;

  list(filter: IVendorListFilter): Observable<{ items: IVendor[]; meta: IPaginationMeta }> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    }
    return this.http.get<IApiSuccessResponse<IVendor[]>>(this.base, { params }).pipe(map((res) => ({ items: res.data, meta: res.meta as IPaginationMeta })));
  }

  getById(id: string): Observable<IVendor> {
    return this.http.get<IApiSuccessResponse<IVendor>>(`${this.base}/${id}`).pipe(map((res) => res.data));
  }

  create(payload: ICreateVendorPayload): Observable<IVendor> {
    return this.http.post<IApiSuccessResponse<IVendor>>(this.base, payload).pipe(map((res) => res.data));
  }

  update(id: string, payload: IUpdateVendorPayload): Observable<IVendor> {
    return this.http.patch<IApiSuccessResponse<IVendor>>(`${this.base}/${id}`, payload).pipe(map((res) => res.data));
  }
}
