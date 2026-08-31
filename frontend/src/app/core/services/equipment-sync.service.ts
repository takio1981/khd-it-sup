import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { IApiSuccessResponse } from '../models/api-response.model';
import type { IEquipmentSyncStatus } from '../models/equipment-sync.model';

@Injectable({ providedIn: 'root' })
export class EquipmentSyncService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/equipment-sync`;

  getStatus(): Observable<IEquipmentSyncStatus> {
    return this.http.get<IApiSuccessResponse<IEquipmentSyncStatus>>(`${this.base}/status`).pipe(map((res) => res.data));
  }

  triggerSync(): Observable<{ started: boolean }> {
    return this.http.post<IApiSuccessResponse<{ started: boolean }>>(`${this.base}/run`, {}).pipe(map((res) => res.data));
  }
}
