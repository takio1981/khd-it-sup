import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { IApiSuccessResponse } from '../models/api-response.model';

export interface IGlobalSearchTicket {
  id: string;
  ticketNumber: string;
  description: string;
  status: string;
  assetLabel: string | null;
}

export interface IGlobalSearchAsset {
  id: string;
  assetNumber: string;
  label: string;
  status: string;
}

export interface IGlobalSearchUser {
  id: string;
  fullName: string;
  username: string;
  email: string | null;
}

export interface IGlobalSearchLoan {
  id: string;
  assetLabel: string;
  borrowerName: string;
  status: 'BORROWED' | 'OVERDUE' | 'RETURNED';
}

export interface IGlobalSearchResult {
  tickets: IGlobalSearchTicket[];
  assets: IGlobalSearchAsset[];
  users: IGlobalSearchUser[];
  loans: IGlobalSearchLoan[];
}

/** ค้นหาข้ามระบบ (ตั๋วซ่อม/ครุภัณฑ์/ผู้ใช้) — ผลลัพธ์แต่ละประเภทถูกกรองตามสิทธิ์ของผู้ใช้แล้วโดย backend */
@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/search`;

  search(q: string): Observable<IGlobalSearchResult> {
    return this.http.get<IApiSuccessResponse<IGlobalSearchResult>>(this.base, { params: { q } }).pipe(map((res) => res.data));
  }
}
