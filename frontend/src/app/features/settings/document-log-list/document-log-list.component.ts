import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { DocumentService } from '../../../core/services/document.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import type { IGeneratedDocument } from '../../../core/models/document.model';

@Component({
  selector: 'khd-document-log-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MatTableModule, MatPaginatorModule, MatButtonModule, IconComponent],
  templateUrl: './document-log-list.component.html',
})
export class DocumentLogListComponent {
  private readonly documentService = inject(DocumentService);
  private readonly router = inject(Router);

  readonly displayedColumns = ['runningNumber', 'templateCode', 'ticket', 'generatedAt', 'actions'];
  readonly docs = signal<IGeneratedDocument[]>([]);
  readonly total = signal(0);
  readonly pageSize = signal(20);
  readonly pageIndex = signal(0);
  readonly loading = signal(true);

  constructor() {
    this.fetch();
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.fetch();
  }

  fetch(): void {
    this.loading.set(true);
    this.documentService.list({ page: this.pageIndex() + 1, limit: this.pageSize() }).subscribe((res) => {
      this.docs.set(res.items);
      this.total.set(res.meta.total);
      this.loading.set(false);
    });
  }

  viewTicket(doc: IGeneratedDocument): void {
    if (doc.ticket) void this.router.navigate(['/repair-tickets', doc.ticket.id]);
  }

  viewFile(doc: IGeneratedDocument): void {
    this.documentService.getFileBlob(doc.fileUrl).subscribe((blob) => {
      window.open(URL.createObjectURL(blob), '_blank');
    });
  }
}
