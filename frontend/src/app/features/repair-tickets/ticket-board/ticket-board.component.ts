import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CdkDropList, CdkDropListGroup, CdkDrag, type CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin } from 'rxjs';
import { RepairTicketService } from '../../../core/services/repair-ticket.service';
import { WorkflowService } from '../../../core/services/workflow.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { URGENCY_LABEL_TH, URGENCY_COLOR } from '../../../core/constants/status.const';
import type { IRepairTicketListItem } from '../../../core/models/repair-ticket.model';
import { KhdNumberPipe } from '../../../shared/pipes/khd-number.pipe';

const BOARD_TEMPLATE_CODE = 'REPAIR_INTERNAL';
/** DRAFT ไม่มี transition ใดๆ ในระบบเข้าไปถึง (ตั๋วจริงไม่เคยอยู่สถานะนี้) จึงไม่ต้องแสดงเป็นคอลัมน์ */
const EXCLUDED_STEP_CODES = new Set(['DRAFT']);
/** จำนวนตั๋วต่อคอลัมน์ที่ดึงมาแสดง — งานแจ้งซ่อมที่ "active" จริงในแต่ละขั้นตอนไม่ควรเกินนี้ในการใช้งานจริง */
const COLUMN_TICKET_LIMIT = 100;

interface IKanbanColumn {
  stepId: string;
  stepCode: string;
  stepNameTh: string;
  colorCode: string;
  tickets: IRepairTicketListItem[];
}

@Component({
  selector: 'khd-ticket-board',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CdkDropList, CdkDropListGroup, CdkDrag, MatButtonModule, MatProgressSpinnerModule, IconComponent, KhdNumberPipe],
  templateUrl: './ticket-board.component.html',
  styleUrl: './ticket-board.component.scss',
})
export class TicketBoardComponent {
  private readonly repairTicketService = inject(RepairTicketService);
  private readonly workflowService = inject(WorkflowService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  readonly urgencyLabels = URGENCY_LABEL_TH;
  readonly urgencyColor = URGENCY_COLOR;

  readonly loading = signal(true);
  readonly columns = signal<IKanbanColumn[]>([]);

  /** fromStepId -> Set<toStepId> ที่มี transition ให้เดินได้จริงตาม workflow — ใช้ปฏิเสธการลากไปคอลัมน์ที่ไม่มีเส้นทาง */
  private validTargetsByFromStepId = new Map<string, Set<string>>();
  /** `${fromStepId}|${toStepId}` -> conditionKey ของ transition นั้น (ถ้ามี) — ต้องส่งกลับไปพร้อม transition call */
  private conditionKeyByEdge = new Map<string, string | null>();

  constructor() {
    this.loadBoard();
  }

  private loadBoard(): void {
    this.loading.set(true);
    this.workflowService.getTemplateStructure(BOARD_TEMPLATE_CODE).subscribe((template) => {
      this.validTargetsByFromStepId = new Map();
      this.conditionKeyByEdge = new Map();
      for (const t of template.transitions) {
        if (!t.fromStepId) continue;
        this.conditionKeyByEdge.set(`${t.fromStepId}|${t.toStepId}`, t.conditionKey);
        if (!this.validTargetsByFromStepId.has(t.fromStepId)) this.validTargetsByFromStepId.set(t.fromStepId, new Set());
        this.validTargetsByFromStepId.get(t.fromStepId)!.add(t.toStepId);
      }

      const activeSteps = template.steps
        .filter((s) => !s.isTerminal && !EXCLUDED_STEP_CODES.has(s.stepCode))
        .sort((a, b) => a.stepOrder - b.stepOrder);

      if (activeSteps.length === 0) {
        this.columns.set([]);
        this.loading.set(false);
        return;
      }

      forkJoin(activeSteps.map((s) => this.repairTicketService.list({ status: s.stepCode, limit: COLUMN_TICKET_LIMIT }))).subscribe(
        (results) => {
          this.columns.set(
            activeSteps.map((s, i) => ({
              stepId: s.id,
              stepCode: s.stepCode,
              stepNameTh: s.stepNameTh,
              colorCode: s.colorCode ?? '#6B7280',
              tickets: results[i].items,
            })),
          );
          this.loading.set(false);
        },
      );
    });
  }

  viewTicket(ticket: IRepairTicketListItem): void {
    void this.router.navigate(['/repair-tickets', ticket.id]);
  }

  drop(event: CdkDragDrop<IRepairTicketListItem[]>, targetColumn: IKanbanColumn): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      this.columns.update((cols) => [...cols]);
      return;
    }

    const sourceColumn = this.columns().find((c) => c.stepCode === event.previousContainer.id);
    if (!sourceColumn) return;
    const ticket = event.previousContainer.data[event.previousIndex];

    const validTargets = this.validTargetsByFromStepId.get(sourceColumn.stepId);
    if (!validTargets?.has(targetColumn.stepId)) {
      this.snackBar.open(
        `ไม่สามารถย้ายจาก "${sourceColumn.stepNameTh}" ไปยัง "${targetColumn.stepNameTh}" ได้ (ไม่มีเส้นทางนี้ใน workflow)`,
        'ปิด',
        { duration: 3500 },
      );
      return;
    }

    const conditionKey = this.conditionKeyByEdge.get(`${sourceColumn.stepId}|${targetColumn.stepId}`) ?? undefined;

    transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    this.columns.update((cols) => [...cols]);

    this.repairTicketService.transition(ticket.id, targetColumn.stepCode, conditionKey).subscribe({
      next: (updated) => {
        ticket.status = updated.status;
        this.snackBar.open(`ย้าย ${ticket.ticketNumber} ไปยัง "${targetColumn.stepNameTh}" แล้ว`, 'ปิด', { duration: 2000 });
      },
      error: () => {
        transferArrayItem(event.container.data, event.previousContainer.data, event.currentIndex, event.previousIndex);
        this.columns.update((cols) => [...cols]);
        this.snackBar.open('ย้ายสถานะไม่สำเร็จ กรุณาลองใหม่', 'ปิด', { duration: 3000 });
      },
    });
  }
}
