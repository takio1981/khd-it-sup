import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { IApiSuccessResponse, IPaginationMeta } from '../models/api-response.model';
import type { ICreateVendorOrderPayload, IUpdateVendorOrderPayload, IVendorRepairOrder } from '../models/vendor.model';

export interface IVendorOrderFilter {
  page?: number;
  limit?: number;
  ticketId?: string;
  vendorId?: string;
  status?: string;
}

@Injectable({ providedIn: 'root' })
export class VendorRepairOrderService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/vendor-repair-orders`;

  list(filter: IVendorOrderFilter): Observable<{ items: IVendorRepairOrder[]; meta: IPaginationMeta }> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    }
    return this.http
      .get<IApiSuccessResponse<IVendorRepairOrder[]>>(this.base, { params })
      .pipe(map((res) => ({ items: res.data, meta: res.meta as IPaginationMeta })));
  }

  getById(id: string): Observable<IVendorRepairOrder> {
    return this.http.get<IApiSuccessResponse<IVendorRepairOrder>>(`${this.base}/${id}`).pipe(map((res) => res.data));
  }

  create(payload: ICreateVendorOrderPayload): Observable<IVendorRepairOrder> {
    return this.http.post<IApiSuccessResponse<IVendorRepairOrder>>(this.base, payload).pipe(map((res) => res.data));
  }

  update(id: string, payload: IUpdateVendorOrderPayload): Observable<IVendorRepairOrder> {
    return this.http.patch<IApiSuccessResponse<IVendorRepairOrder>>(`${this.base}/${id}`, payload).pipe(map((res) => res.data));
  }

  uploadQuotationFile(id: string, file: File): Observable<IVendorRepairOrder> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<IApiSuccessResponse<IVendorRepairOrder>>(`${this.base}/${id}/quotation-file`, formData).pipe(map((res) => res.data));
  }

  uploadInvoiceFile(id: string, file: File): Observable<IVendorRepairOrder> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<IApiSuccessResponse<IVendorRepairOrder>>(`${this.base}/${id}/invoice-file`, formData).pipe(map((res) => res.data));
  }
}
