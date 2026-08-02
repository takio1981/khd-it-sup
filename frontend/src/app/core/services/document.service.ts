import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { resolveBackendFileUrl } from '../utils/file-url.util';
import type { IApiSuccessResponse, IPaginationMeta } from '../models/api-response.model';
import type { IDocumentTemplate, IGeneratedDocument } from '../models/document.model';

export interface IDocumentListFilter {
  page?: number;
  limit?: number;
  ticketId?: string;
  templateCode?: string;
}

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  listTemplates(): Observable<IDocumentTemplate[]> {
    return this.http.get<IApiSuccessResponse<IDocumentTemplate[]>>(`${this.base}/document-templates`).pipe(map((res) => res.data));
  }

  list(filter: IDocumentListFilter): Observable<{ items: IGeneratedDocument[]; meta: IPaginationMeta }> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    }
    return this.http
      .get<IApiSuccessResponse<IGeneratedDocument[]>>(`${this.base}/documents`, { params })
      .pipe(map((res) => ({ items: res.data, meta: res.meta as IPaginationMeta })));
  }

  /** ออกเลขที่เอกสารจริง — ส่งไฟล์ PDF ที่ frontend render เสร็จแล้ว (blob) พร้อม templateCode/ticketId */
  generate(templateCode: string, file: Blob, filename: string, ticketId?: string): Observable<IGeneratedDocument> {
    const formData = new FormData();
    formData.append('file', file, filename);
    formData.append('templateCode', templateCode);
    if (ticketId) formData.append('ticketId', ticketId);
    return this.http
      .post<IApiSuccessResponse<IGeneratedDocument>>(`${this.base}/documents/generate`, formData)
      .pipe(map((res) => res.data));
  }

  /** ไฟล์เอกสารต้องแนบ Authorization header เสมอ — โหลดผ่าน HttpClient เป็น blob แทน <a href> ตรง ๆ */
  getFileBlob(fileUrl: string): Observable<Blob> {
    return this.http.get(resolveBackendFileUrl(fileUrl), { responseType: 'blob' });
  }
}
