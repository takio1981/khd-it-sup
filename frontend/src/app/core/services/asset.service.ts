import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { resolveBackendFileUrl } from '../utils/file-url.util';
import type { IApiSuccessResponse, IPaginationMeta } from '../models/api-response.model';
import type {
  IAsset,
  IAssetCategory,
  IAssetHistoryItem,
  IAssetPhoto,
  ICreateAssetCategoryPayload,
  ICreateAssetPayload,
} from '../models/asset.model';

export interface IAssetListFilter {
  page?: number;
  limit?: number;
  categoryId?: string;
  departmentId?: string;
  status?: string;
  keyword?: string;
}

@Injectable({ providedIn: 'root' })
export class AssetService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/assets`;

  list(filter: IAssetListFilter): Observable<{ items: IAsset[]; meta: IPaginationMeta }> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http
      .get<IApiSuccessResponse<IAsset[]>>(this.base, { params })
      .pipe(map((res) => ({ items: res.data, meta: res.meta as IPaginationMeta })));
  }

  getCategories(): Observable<IAssetCategory[]> {
    return this.http.get<IApiSuccessResponse<IAssetCategory[]>>(`${this.base}/categories`).pipe(map((res) => res.data));
  }

  createCategory(payload: ICreateAssetCategoryPayload): Observable<IAssetCategory> {
    return this.http
      .post<IApiSuccessResponse<IAssetCategory>>(`${this.base}/categories`, payload)
      .pipe(map((res) => res.data));
  }

  updateCategory(id: string, payload: Partial<ICreateAssetCategoryPayload>): Observable<IAssetCategory> {
    return this.http
      .patch<IApiSuccessResponse<IAssetCategory>>(`${this.base}/categories/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  removeCategory(id: string): Observable<void> {
    return this.http.delete<IApiSuccessResponse<unknown>>(`${this.base}/categories/${id}`).pipe(map(() => undefined));
  }

  getById(id: string): Observable<IAsset> {
    return this.http.get<IApiSuccessResponse<IAsset>>(`${this.base}/${id}`).pipe(map((res) => res.data));
  }

  getHistory(id: string): Observable<IAssetHistoryItem[]> {
    return this.http.get<IApiSuccessResponse<IAssetHistoryItem[]>>(`${this.base}/${id}/history`).pipe(map((res) => res.data));
  }

  create(payload: ICreateAssetPayload): Observable<IAsset> {
    return this.http.post<IApiSuccessResponse<IAsset>>(this.base, payload).pipe(map((res) => res.data));
  }

  update(id: string, payload: Partial<ICreateAssetPayload>): Observable<IAsset> {
    return this.http.patch<IApiSuccessResponse<IAsset>>(`${this.base}/${id}`, payload).pipe(map((res) => res.data));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<IApiSuccessResponse<unknown>>(`${this.base}/${id}`).pipe(map(() => undefined));
  }

  uploadPhotos(id: string, files: File[]): Observable<IAssetPhoto[]> {
    const formData = new FormData();
    files.forEach((f) => formData.append('photos', f));
    return this.http
      .post<IApiSuccessResponse<IAssetPhoto[]>>(`${this.base}/${id}/photos`, formData)
      .pipe(map((res) => res.data));
  }

  removePhoto(id: string, photoId: string): Observable<void> {
    return this.http.delete<IApiSuccessResponse<unknown>>(`${this.base}/${id}/photos/${photoId}`).pipe(map(() => undefined));
  }

  /** ไฟล์รูปครุภัณฑ์ต้องแนบ Authorization header เสมอ — โหลดผ่าน HttpClient เป็น blob แทน <img src> ตรง ๆ */
  getPhotoBlob(fileUrl: string): Observable<Blob> {
    return this.http.get(resolveBackendFileUrl(fileUrl), { responseType: 'blob' });
  }

  exportFile(filter: Omit<IAssetListFilter, 'page' | 'limit'>, format: 'xlsx' | 'csv'): Observable<Blob> {
    let params = new HttpParams().set('format', format);
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    }
    return this.http.get(`${this.base}/export`, { params, responseType: 'blob' });
  }
}
