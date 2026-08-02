import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { IApiSuccessResponse } from '../models/api-response.model';
import type {
  IDashboardAnalytics,
  IDashboardSummary,
  IDepartmentRankingItem,
  IMonthlyChartPoint,
  ITechnicianWorkloadItem,
  IYearlyChartPoint,
} from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/dashboard`;

  getSummary(): Observable<IDashboardSummary> {
    return this.http.get<IApiSuccessResponse<IDashboardSummary>>(`${this.base}/summary`).pipe(map((res) => res.data));
  }

  getMonthlyChart(year: number): Observable<IMonthlyChartPoint[]> {
    const params = new HttpParams().set('year', year);
    return this.http
      .get<IApiSuccessResponse<IMonthlyChartPoint[]>>(`${this.base}/charts/monthly`, { params })
      .pipe(map((res) => res.data));
  }

  getYearlyChart(): Observable<IYearlyChartPoint[]> {
    return this.http.get<IApiSuccessResponse<IYearlyChartPoint[]>>(`${this.base}/charts/yearly`).pipe(map((res) => res.data));
  }

  getDepartmentRanking(limit = 10): Observable<IDepartmentRankingItem[]> {
    const params = new HttpParams().set('limit', limit);
    return this.http
      .get<IApiSuccessResponse<IDepartmentRankingItem[]>>(`${this.base}/charts/department-ranking`, { params })
      .pipe(map((res) => res.data));
  }

  getTechnicianWorkload(): Observable<ITechnicianWorkloadItem[]> {
    return this.http
      .get<IApiSuccessResponse<ITechnicianWorkloadItem[]>>(`${this.base}/charts/technician-workload`)
      .pipe(map((res) => res.data));
  }

  getAnalytics(): Observable<IDashboardAnalytics> {
    return this.http.get<IApiSuccessResponse<IDashboardAnalytics>>(`${this.base}/analytics`).pipe(map((res) => res.data));
  }

  exportExcel(year: number): Observable<Blob> {
    const params = new HttpParams().set('year', year);
    return this.http.get(`${this.base}/export`, { params, responseType: 'blob' });
  }
}
