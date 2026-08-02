import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { IApiSuccessResponse, IPaginationMeta } from '../models/api-response.model';
import type {
  ICreateSparePartPayload,
  IRecordTransactionPayload,
  ISparePart,
  ISparePartTransaction,
  IUpdateSparePartPayload,
} from '../models/spare-part.model';

export interface ISparePartListFilter {
  page?: number;
  limit?: number;
  keyword?: string;
  lowStockOnly?: boolean;
}

export interface ISparePartTxnFilter {
  page?: number;
  limit?: number;
  ticketId?: string;
}

@Injectable({ providedIn: 'root' })
export class SparePartService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/spare-parts`;

  list(filter: ISparePartListFilter): Observable<{ items: ISparePart[]; meta: IPaginationMeta }> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    }
    return this.http.get<IApiSuccessResponse<ISparePart[]>>(this.base, { params }).pipe(map((res) => ({ items: res.data, meta: res.meta as IPaginationMeta })));
  }

  getById(id: string): Observable<ISparePart> {
    return this.http.get<IApiSuccessResponse<ISparePart>>(`${this.base}/${id}`).pipe(map((res) => res.data));
  }

  create(payload: ICreateSparePartPayload): Observable<ISparePart> {
    return this.http.post<IApiSuccessResponse<ISparePart>>(this.base, payload).pipe(map((res) => res.data));
  }

  update(id: string, payload: IUpdateSparePartPayload): Observable<ISparePart> {
    return this.http.patch<IApiSuccessResponse<ISparePart>>(`${this.base}/${id}`, payload).pipe(map((res) => res.data));
  }

  listTransactions(filter: ISparePartTxnFilter): Observable<{ items: ISparePartTransaction[]; meta: IPaginationMeta }> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    }
    return this.http
      .get<IApiSuccessResponse<ISparePartTransaction[]>>(`${this.base}/transactions`, { params })
      .pipe(map((res) => ({ items: res.data, meta: res.meta as IPaginationMeta })));
  }

  recordTransaction(sparePartId: string, payload: IRecordTransactionPayload): Observable<ISparePartTransaction> {
    return this.http
      .post<IApiSuccessResponse<ISparePartTransaction>>(`${this.base}/${sparePartId}/transactions`, payload)
      .pipe(map((res) => res.data));
  }
}
