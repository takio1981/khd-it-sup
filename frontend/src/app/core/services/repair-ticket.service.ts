import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { resolveBackendFileUrl } from '../utils/file-url.util';
import type { IApiSuccessResponse, IPaginationMeta } from '../models/api-response.model';
import type {
  ICreateTicketPayload,
  IInspectionPayload,
  IRepairSummary,
  IRepairTicketDetail,
  IRepairTicketListItem,
  ITimelineEvent,
} from '../models/repair-ticket.model';

export type IRepairSummaryPayload = Pick<IRepairSummary, 'rootCause' | 'repairAction' | 'partsUsed' | 'recommendation'> & {
  /** base64 PNG data URL จาก khd-signature-pad — undefined ถ้ายังไม่ได้เซ็น (ไม่ใช่ null เหมือน read-model) */
  summarySignature?: string;
};

export interface ITicketListFilter {
  page?: number;
  limit?: number;
  status?: string;
  urgency?: string;
  departmentId?: string;
  assignedTechnicianId?: string;
  assetId?: string;
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable({ providedIn: 'root' })
export class RepairTicketService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/repair-tickets`;

  list(filter: ITicketListFilter): Observable<{ items: IRepairTicketListItem[]; meta: IPaginationMeta }> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http
      .get<IApiSuccessResponse<IRepairTicketListItem[]>>(this.base, { params })
      .pipe(map((res) => ({ items: res.data, meta: res.meta as IPaginationMeta })));
  }

  getById(id: string): Observable<IRepairTicketDetail> {
    return this.http.get<IApiSuccessResponse<IRepairTicketDetail>>(`${this.base}/${id}`).pipe(map((res) => res.data));
  }

  getTimeline(id: string): Observable<ITimelineEvent[]> {
    return this.http.get<IApiSuccessResponse<ITimelineEvent[]>>(`${this.base}/${id}/timeline`).pipe(map((res) => res.data));
  }

  /** จำนวนใบแจ้งซ่อมที่ยังไม่มีแอดมิน/ช่างเข้าดู — ใช้แสดงตัวเลขที่เมนู sidebar */
  getUnviewedCount(): Observable<number> {
    return this.http
      .get<IApiSuccessResponse<{ count: number }>>(`${this.base}/unviewed-count`)
      .pipe(map((res) => res.data.count));
  }

  /** files (สูงสุด 3 ภาพ — บังคับที่ backend ด้วย) ถ้ามีจะส่งเป็น multipart/form-data พร้อมแนบไฟล์ในคำขอเดียวกันเลย */
  create(payload: ICreateTicketPayload, files?: File[]): Observable<IRepairTicketDetail> {
    if (files?.length) {
      const formData = new FormData();
      for (const [key, value] of Object.entries(payload)) {
        if (value !== undefined && value !== null && value !== '') formData.append(key, String(value));
      }
      files.forEach((file) => formData.append('attachments', file));
      return this.http.post<IApiSuccessResponse<IRepairTicketDetail>>(this.base, formData).pipe(map((res) => res.data));
    }
    return this.http.post<IApiSuccessResponse<IRepairTicketDetail>>(this.base, payload).pipe(map((res) => res.data));
  }

  receive(id: string): Observable<IRepairTicketDetail> {
    return this.http.post<IApiSuccessResponse<IRepairTicketDetail>>(`${this.base}/${id}/receive`, {}).pipe(map((res) => res.data));
  }

  assign(id: string, technicianId: string): Observable<IRepairTicketDetail> {
    return this.http
      .post<IApiSuccessResponse<IRepairTicketDetail>>(`${this.base}/${id}/assign`, { technicianId })
      .pipe(map((res) => res.data));
  }

  transition(
    id: string,
    toStepCode: string,
    conditionKey?: string,
    comment?: string,
    repairSummary?: IRepairSummaryPayload,
  ): Observable<IRepairTicketDetail> {
    return this.http
      .post<IApiSuccessResponse<IRepairTicketDetail>>(`${this.base}/${id}/transition`, {
        toStepCode,
        conditionKey,
        comment,
        repairSummary,
      })
      .pipe(map((res) => res.data));
  }

  cancel(id: string, reason: string): Observable<IRepairTicketDetail> {
    return this.http
      .post<IApiSuccessResponse<IRepairTicketDetail>>(`${this.base}/${id}/cancel`, { reason })
      .pipe(map((res) => res.data));
  }

  close(id: string, acceptorSignature?: string): Observable<IRepairTicketDetail> {
    return this.http
      .post<IApiSuccessResponse<IRepairTicketDetail>>(`${this.base}/${id}/close`, { acceptorSignature })
      .pipe(map((res) => res.data));
  }

  addComment(id: string, comment: string): Observable<ITimelineEvent> {
    return this.http
      .post<IApiSuccessResponse<ITimelineEvent>>(`${this.base}/${id}/comment`, { comment })
      .pipe(map((res) => res.data));
  }

  uploadAttachments(id: string, files: File[]): Observable<unknown> {
    const formData = new FormData();
    files.forEach((f) => formData.append('attachments', f));
    return this.http.post(`${this.base}/${id}/attachments`, formData);
  }

  updateRepairSummary(id: string, payload: IRepairSummaryPayload): Observable<IRepairTicketDetail> {
    return this.http
      .patch<IApiSuccessResponse<IRepairTicketDetail>>(`${this.base}/${id}/summary`, payload)
      .pipe(map((res) => res.data));
  }

  approveUnitHead(id: string): Observable<IRepairTicketDetail> {
    return this.http
      .post<IApiSuccessResponse<IRepairTicketDetail>>(`${this.base}/${id}/approve-unit-head`, {})
      .pipe(map((res) => res.data));
  }

  recordInspection(id: string, payload: IInspectionPayload): Observable<IRepairTicketDetail> {
    return this.http
      .post<IApiSuccessResponse<IRepairTicketDetail>>(`${this.base}/${id}/inspection`, payload)
      .pipe(map((res) => res.data));
  }

  approveDigitalHealthHead(id: string): Observable<IRepairTicketDetail> {
    return this.http
      .post<IApiSuccessResponse<IRepairTicketDetail>>(`${this.base}/${id}/approve-digital-health-head`, {})
      .pipe(map((res) => res.data));
  }

  /** ไฟล์แนบต้องแนบ Authorization header เสมอ (ดู serveFile.controller.ts) — โหลดผ่าน HttpClient เป็น blob แทน <img src>/<a href> ตรง ๆ */
  getAttachmentBlob(fileUrl: string): Observable<Blob> {
    return this.http.get(resolveBackendFileUrl(fileUrl), { responseType: 'blob' });
  }

  exportFile(filter: Omit<ITicketListFilter, 'page' | 'limit'>, format: 'xlsx' | 'csv'): Observable<Blob> {
    let params = new HttpParams().set('format', format);
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    }
    return this.http.get(`${this.base}/export`, { params, responseType: 'blob' });
  }
}
