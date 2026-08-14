import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Location } from '@angular/common';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { IApiSuccessResponse } from '../models/api-response.model';

export interface IGenerateQrResult {
  assetId: string;
  assetNumber: string;
  qrToken: string;
  scanUrl: string;
  dataUrl: string;
}

export interface IQrScanActiveLoan {
  id: string;
  borrowerId: string;
  borrowerName: string;
  borrowDate: string;
  expectedReturnDate: string | null;
}

export interface IQrScanResult {
  id: string;
  assetNumber: string;
  govAssetNumber: string | null;
  model: string | null;
  brand: string | null;
  status: string;
  photoUrl: string | null;
  category: { nameTh: string; nameEn: string; icon: string | null };
  department: { nameTh: string } | null;
  room: { name: string } | null;
  floor: { name: string } | null;
  building: { name: string } | null;
  repairTickets: { id: string; ticketNumber: string; status: string; createdAt: string; closedAt: string | null }[];
  activeLoan: IQrScanActiveLoan | null;
}

@Injectable({ providedIn: 'root' })
export class QrCodeService {
  private readonly http = inject(HttpClient);
  private readonly location = inject(Location);
  private readonly base = `${environment.apiBaseUrl}/qrcodes`;

  /** สร้าง/สร้างใหม่ QR (regenerate) — ทำให้ QR/สติกเกอร์เดิมใช้งานไม่ได้ทันที ใช้เฉพาะตอนต้องการ token ใหม่จริง ๆ */
  generate(assetId: string): Observable<IGenerateQrResult> {
    return this.http
      .post<IApiSuccessResponse<IGenerateQrResult>>(`${this.base}/assets/${assetId}/generate`, {})
      .pipe(map((res) => res.data));
  }

  printUrl(assetId: string): string {
    return `${this.base}/assets/${assetId}/print`;
  }

  /** ดึงรูป QR สำหรับตัวอย่างก่อนพิมพ์ — ใช้ QR เดิมถ้ามีอยู่แล้ว (ไม่ regenerate), สร้างให้อัตโนมัติเฉพาะกรณียังไม่เคยมี */
  printPng(assetId: string): Observable<Blob> {
    return this.http.get(`${this.base}/assets/${assetId}/print`, { responseType: 'blob' });
  }

  bulkPrint(assetIds: string[]): Observable<{ assetId: string; assetNumber: string; dataUrl: string }[]> {
    return this.http
      .post<IApiSuccessResponse<{ assetId: string; assetNumber: string; dataUrl: string }[]>>(`${this.base}/bulk-print`, { assetIds })
      .pipe(map((res) => res.data));
  }

  /** สร้าง URL สแกน QR จาก token — ใช้ origin ปัจจุบันของ SPA เสมอ + เคารพ base href (ถูกต้องไม่ว่าจะ deploy ที่ domain/path ไหน) */
  buildScanUrl(qrToken: string): string {
    return `${window.location.origin}${this.location.prepareExternalUrl(`/qr/scan/${encodeURIComponent(qrToken)}`)}`;
  }

  resolve(token: string): Observable<IQrScanResult> {
    return this.http
      .get<IApiSuccessResponse<IQrScanResult>>(`${this.base}/resolve/${encodeURIComponent(token)}`)
      .pipe(map((res) => res.data));
  }
}
