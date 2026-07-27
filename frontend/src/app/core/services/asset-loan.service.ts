import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { IApiSuccessResponse, IPaginatedResult, IPaginationMeta } from '../models/api-response.model';
import type {
  IAssetLoan,
  IAssetLoanChartData,
  IAssetLoanStats,
  AssetLoanStatus,
  ICreateAssetLoanPayload,
  IUpdateAssetLoanPayload,
} from '../models/asset-loan.model';

export interface IListAssetLoansParams {
  page?: number;
  limit?: number;
  status?: AssetLoanStatus;
  keyword?: string;
}

@Injectable({ providedIn: 'root' })
export class AssetLoanService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/asset-loans`;

  list(params: IListAssetLoansParams): Observable<IPaginatedResult<IAssetLoan>> {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return this.http
      .get<IApiSuccessResponse<IAssetLoan[]>>(this.base, { params: httpParams })
      .pipe(map((res) => ({ items: res.data, meta: res.meta as IPaginationMeta })));
  }

  getStats(): Observable<IAssetLoanStats> {
    return this.http.get<IApiSuccessResponse<IAssetLoanStats>>(`${this.base}/stats`).pipe(map((res) => res.data));
  }

  getChartData(): Observable<IAssetLoanChartData> {
    return this.http.get<IApiSuccessResponse<IAssetLoanChartData>>(`${this.base}/chart`).pipe(map((res) => res.data));
  }

  getById(id: string): Observable<IAssetLoan> {
    return this.http.get<IApiSuccessResponse<IAssetLoan>>(`${this.base}/${id}`).pipe(map((res) => res.data));
  }

  create(payload: ICreateAssetLoanPayload): Observable<IAssetLoan> {
    return this.http.post<IApiSuccessResponse<IAssetLoan>>(this.base, payload).pipe(map((res) => res.data));
  }

  update(id: string, payload: IUpdateAssetLoanPayload): Observable<IAssetLoan> {
    return this.http.patch<IApiSuccessResponse<IAssetLoan>>(`${this.base}/${id}`, payload).pipe(map((res) => res.data));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<IApiSuccessResponse<unknown>>(`${this.base}/${id}`).pipe(map(() => undefined));
  }

  returnLoan(id: string, conditionOnReturn?: string): Observable<IAssetLoan> {
    return this.http
      .post<IApiSuccessResponse<IAssetLoan>>(`${this.base}/${id}/return`, { conditionOnReturn })
      .pipe(map((res) => res.data));
  }
}
