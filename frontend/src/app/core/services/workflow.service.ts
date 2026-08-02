import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { IApiSuccessResponse } from '../models/api-response.model';
import type { IWorkflowTemplateStructure } from '../models/workflow.model';

@Injectable({ providedIn: 'root' })
export class WorkflowService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/workflow-templates`;

  getTemplateStructure(code: string): Observable<IWorkflowTemplateStructure> {
    return this.http.get<IApiSuccessResponse<IWorkflowTemplateStructure>>(`${this.base}/${code}`).pipe(map((res) => res.data));
  }
}
