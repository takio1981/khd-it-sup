import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, debounceTime, distinctUntilChanged, of, Subject, switchMap } from 'rxjs';
import { SearchService, type IGlobalSearchResult } from '../../../core/services/search.service';
import { IconComponent } from '../icon/icon.component';
import { getStatusColor, getStatusLabel } from '../../../core/constants/status.const';

const EMPTY_RESULT: IGlobalSearchResult = { tickets: [], assets: [], users: [], loans: [] };

const LOAN_STATUS_LABEL_TH: Record<string, string> = {
  BORROWED: 'กำลังยืม',
  OVERDUE: 'เกินกำหนด',
  RETURNED: 'คืนแล้ว',
};

const LOAN_STATUS_COLOR: Record<string, string> = {
  BORROWED: '#3B82F6',
  OVERDUE: '#EF4444',
  RETURNED: '#22C55E',
};

/** ค้นหาข้ามระบบ (ตั๋วซ่อม/ครุภัณฑ์/ผู้ใช้) — เปิดจากปุ่มแว่นขยายในแถบด้านบน */
@Component({
  selector: 'khd-global-search-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatDialogModule, MatProgressSpinnerModule, MatTooltipModule, IconComponent],
  templateUrl: './global-search-dialog.component.html',
})
export class GlobalSearchDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<GlobalSearchDialogComponent>);
  private readonly router = inject(Router);
  private readonly searchService = inject(SearchService);

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly getStatusLabel = getStatusLabel;
  readonly getStatusColor = getStatusColor;
  readonly getLoanStatusLabel = (status: string) => LOAN_STATUS_LABEL_TH[status] ?? status;
  readonly getLoanStatusColor = (status: string) => LOAN_STATUS_COLOR[status] ?? '#9CA3AF';

  keyword = '';
  readonly loading = signal(false);
  readonly searched = signal(false);
  readonly result = signal<IGlobalSearchResult>(EMPTY_RESULT);
  private readonly keyword$ = new Subject<string>();

  readonly hasAnyResult = () =>
    this.result().tickets.length > 0 ||
    this.result().assets.length > 0 ||
    this.result().users.length > 0 ||
    this.result().loans.length > 0;

  constructor() {
    this.keyword$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          const trimmed = q.trim();
          if (!trimmed) {
            this.loading.set(false);
            this.searched.set(false);
            return of(EMPTY_RESULT);
          }
          this.loading.set(true);
          return this.searchService.search(trimmed).pipe(catchError(() => of(EMPTY_RESULT)));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((res) => {
        this.loading.set(false);
        this.searched.set(this.keyword.trim().length > 0);
        this.result.set(res);
      });
  }

  onKeywordChange(): void {
    this.keyword$.next(this.keyword);
  }

  goTo(link: string): void {
    this.dialogRef.close();
    void this.router.navigateByUrl(link);
  }

  goToUsers(username: string): void {
    this.dialogRef.close();
    void this.router.navigate(['/users'], { queryParams: { keyword: username } });
  }

  goToLoans(): void {
    this.dialogRef.close();
    void this.router.navigate(['/asset-loans'], { queryParams: { keyword: this.keyword.trim() } });
  }
}
