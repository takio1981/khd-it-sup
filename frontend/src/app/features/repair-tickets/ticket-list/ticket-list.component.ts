import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { RepairTicketService } from '../../../core/services/repair-ticket.service';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { URGENCY_LABEL_TH, URGENCY_COLOR } from '../../../core/constants/status.const';
import { TicketFormComponent } from '../ticket-form/ticket-form.component';
import type { IRepairTicketListItem } from '../../../core/models/repair-ticket.model';

@Component({
  selector: 'khd-ticket-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    DatePipe,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    StatusBadgeComponent,
    IconComponent,
    HasPermissionDirective,
  ],
  templateUrl: './ticket-list.component.html',
})
export class TicketListComponent {
  private readonly repairTicketService = inject(RepairTicketService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  readonly urgencyLabels = URGENCY_LABEL_TH;
  readonly urgencyColor = URGENCY_COLOR;

  readonly displayedColumns = ['ticketNumber', 'description', 'urgency', 'status', 'technician', 'createdAt'];
  readonly tickets = signal<IRepairTicketListItem[]>([]);
  readonly total = signal(0);
  readonly pageSize = signal(20);
  readonly pageIndex = signal(0);
  readonly loading = signal(true);

  keyword = '';
  status = '';
  urgency = '';
  private readonly keyword$ = new Subject<string>();

  constructor() {
    this.keyword$.pipe(debounceTime(350), distinctUntilChanged()).subscribe(() => {
      this.pageIndex.set(0);
      this.fetch();
    });
    this.fetch();
  }

  onKeywordChange(): void {
    this.keyword$.next(this.keyword);
  }

  onFilterChange(): void {
    this.pageIndex.set(0);
    this.fetch();
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.fetch();
  }

  fetch(): void {
    this.loading.set(true);
    this.repairTicketService
      .list({
        page: this.pageIndex() + 1,
        limit: this.pageSize(),
        keyword: this.keyword || undefined,
        status: this.status || undefined,
        urgency: this.urgency || undefined,
      })
      .subscribe((res) => {
        this.tickets.set(res.items);
        this.total.set(res.meta.total);
        this.loading.set(false);
      });
  }

  openCreateForm(): void {
    const ref = this.dialog.open(TicketFormComponent, { width: '520px' });
    ref.afterClosed().subscribe((ticket) => {
      if (ticket) {
        this.fetch();
        void this.router.navigate(['/repair-tickets', ticket.id]);
      }
    });
  }

  viewTicket(ticket: IRepairTicketListItem): void {
    void this.router.navigate(['/repair-tickets', ticket.id]);
  }
}
