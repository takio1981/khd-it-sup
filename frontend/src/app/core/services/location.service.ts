import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { IApiSuccessResponse } from '../models/api-response.model';
import type { IBuilding, IFloor, IRoom } from '../models/location.model';

@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  listBuildings(): Observable<IBuilding[]> {
    return this.http.get<IApiSuccessResponse<IBuilding[]>>(`${this.base}/buildings`).pipe(map((res) => res.data));
  }

  createBuilding(payload: { code: string; name: string }): Observable<IBuilding> {
    return this.http.post<IApiSuccessResponse<IBuilding>>(`${this.base}/buildings`, payload).pipe(map((res) => res.data));
  }

  updateBuilding(id: string, payload: { name: string }): Observable<IBuilding> {
    return this.http.patch<IApiSuccessResponse<IBuilding>>(`${this.base}/buildings/${id}`, payload).pipe(map((res) => res.data));
  }

  removeBuilding(id: string): Observable<void> {
    return this.http.delete<IApiSuccessResponse<unknown>>(`${this.base}/buildings/${id}`).pipe(map(() => undefined));
  }

  listFloors(buildingId?: string): Observable<IFloor[]> {
    let params = new HttpParams();
    if (buildingId) params = params.set('buildingId', buildingId);
    return this.http.get<IApiSuccessResponse<IFloor[]>>(`${this.base}/floors`, { params }).pipe(map((res) => res.data));
  }

  createFloor(payload: { buildingId: string; code: string; name: string }): Observable<IFloor> {
    return this.http.post<IApiSuccessResponse<IFloor>>(`${this.base}/floors`, payload).pipe(map((res) => res.data));
  }

  updateFloor(id: string, payload: { name: string }): Observable<IFloor> {
    return this.http.patch<IApiSuccessResponse<IFloor>>(`${this.base}/floors/${id}`, payload).pipe(map((res) => res.data));
  }

  removeFloor(id: string): Observable<void> {
    return this.http.delete<IApiSuccessResponse<unknown>>(`${this.base}/floors/${id}`).pipe(map(() => undefined));
  }

  listRooms(floorId?: string): Observable<IRoom[]> {
    let params = new HttpParams();
    if (floorId) params = params.set('floorId', floorId);
    return this.http.get<IApiSuccessResponse<IRoom[]>>(`${this.base}/rooms`, { params }).pipe(map((res) => res.data));
  }

  createRoom(payload: { floorId: string; code: string; name: string; departmentId?: string }): Observable<IRoom> {
    return this.http.post<IApiSuccessResponse<IRoom>>(`${this.base}/rooms`, payload).pipe(map((res) => res.data));
  }

  updateRoom(id: string, payload: { name: string; departmentId?: string | null }): Observable<IRoom> {
    return this.http.patch<IApiSuccessResponse<IRoom>>(`${this.base}/rooms/${id}`, payload).pipe(map((res) => res.data));
  }

  removeRoom(id: string): Observable<void> {
    return this.http.delete<IApiSuccessResponse<unknown>>(`${this.base}/rooms/${id}`).pipe(map(() => undefined));
  }
}
