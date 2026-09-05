import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, MatPaginatorIntl, type PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { DocumentService } from '../../../core/services/document.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { downloadBlob } from '../../../core/utils/download.util';
import { exportTableToPdf } from '../../../core/utils/pdf-table-export.util';
import { formatKhdNumber } from '../../../core/utils/number-format.util';
import type { IGeneratedDocument } from '../../../core/models/document.model';
import { KhdNumberPipe } from '../../../shared/pipes/khd-number.pipe';
import { provideKhdPaginatorIntl } from '../../../core/utils/khd-paginator-intl.util';

const EXPORT_PDF_MAX_ROWS = 500;

@Component({
  selector: 'khd-document-log-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MatPaginatorIntl, useFactory: provideKhdPaginatorIntl }],
  imports: [DatePipe, MatTableModule, MatPaginatorModule, MatButtonModule, MatMenuModule, IconComponent, KhdNumberPipe],
  templateUrl: './document-log-list.component.html',
})
export class DocumentLogListComponent {
  private readonly documentService = inject(DocumentService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  readonly displayedColumns = ['runningNumber', 'templateCode', 'ticket', 'generatedAt', 'actions'];
  readonly docs = signal<IGeneratedDocument[]>([]);
  readonly total = signal(0);
  readonly pageSize = signal(20);
  readonly pageIndex = signal(0);
  readonly loading = signal(true);
  readonly exporting = signal(false);

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

  exportExcel(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.documentService.exportFile({}, 'xlsx').subscribe({
      next: (blob) => {
        downloadBlob(blob, `documents-${Date.now()}.xlsx`);
        this.exporting.set(false);
      },
      error: () => {
        this.exporting.set(false);
        this.snackBar.open('Export Excel ไม่สำเร็จ', 'ปิด', { duration: 3000 });
      },
    });
  }

  exportCsv(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.documentService.exportFile({}, 'csv').subscribe({
      next: (blob) => {
        downloadBlob(blob, `documents-${Date.now()}.csv`);
        this.exporting.set(false);
      },
      error: () => {
        this.exporting.set(false);
        this.snackBar.open('Export CSV ไม่สำเร็จ', 'ปิด', { duration: 3000 });
      },
    });
  }

  async exportPdf(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
      const res = await firstValueFrom(this.documentService.list({ page: 1, limit: EXPORT_PDF_MAX_ROWS }));
      await exportTableToPdf({
        title: 'รายงานเอกสารราชการที่ออกแล้ว',
        subtitle: `ทั้งหมด ${formatKhdNumber(res.items.length)} ฉบับ${res.meta.total > res.items.length ? ` (จากทั้งหมด ${formatKhdNumber(res.meta.total)} ฉบับ)` : ''}`,
        columns: ['เลขที่เอกสาร', 'แบบฟอร์ม', 'ใบแจ้งซ่อมที่เกี่ยวข้อง', 'วันที่ออกเอกสาร'],
        rows: res.items.map((d) => [
          d.runningNumber,
          d.templateCode,
          d.ticket?.ticketNumber ?? '-',
          new Date(d.generatedAt).toLocaleString('th-TH'),
        ]),
        filename: `documents-${Date.now()}.pdf`,
      });
    } catch {
      this.snackBar.open('Export PDF ไม่สำเร็จ', 'ปิด', { duration: 3000 });
    } finally {
      this.exporting.set(false);
    }
  }
}
