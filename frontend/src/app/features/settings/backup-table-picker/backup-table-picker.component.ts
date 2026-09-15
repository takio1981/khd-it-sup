import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatCheckboxModule, type MatCheckboxChange } from '@angular/material/checkbox';
import type { IBackupTableGroup } from '../../../core/models/backup.model';

/**
 * Checkbox เลือกตาราง จัดกลุ่มตามโมดูล (จาก GET /backup/tables) — ใช้ร่วมกันทั้งฟอร์มสำรองข้อมูลด้วยตนเอง
 * (backup-list) และฟอร์มตั้งค่าสำรองข้อมูลอัตโนมัติ (backup-settings-form) ไม่มี state ภายในตัวเอง — ควบคุม
 * ทั้งหมดผ่าน input/output (selected ตรงๆ) ให้ parent เป็นคนถือ source of truth
 */
@Component({
  selector: 'khd-backup-table-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCheckboxModule],
  template: `
    <div class="space-y-1 max-h-72 overflow-y-auto pr-1">
      @for (group of groups(); track group.group) {
        <div class="border-b border-black/5 dark:border-white/10 last:border-0 py-1.5">
          <mat-checkbox
            [checked]="isGroupFullySelected(group)"
            [indeterminate]="isGroupPartiallySelected(group)"
            [disabled]="disabled()"
            (change)="toggleGroup(group, $event)"
          >
            <span class="text-sm font-medium">{{ group.labelTh }}</span>
            <span class="text-xs text-neutral-400 ml-1">({{ group.tables.length }})</span>
          </mat-checkbox>
          <div class="flex flex-wrap gap-x-4 gap-y-1 pl-8 mt-1">
            @for (table of group.tables; track table) {
              <mat-checkbox
                [checked]="selected().includes(table)"
                [disabled]="disabled()"
                (change)="toggleTable(table, $event)"
                class="!text-xs"
              >
                <span class="text-xs">{{ table }}</span>
              </mat-checkbox>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class BackupTablePickerComponent {
  readonly groups = input.required<IBackupTableGroup[]>();
  readonly selected = input<string[]>([]);
  readonly disabled = input(false);
  readonly selectedChange = output<string[]>();

  readonly allTables = computed(() => this.groups().flatMap((g) => g.tables));

  isGroupFullySelected(group: IBackupTableGroup): boolean {
    return group.tables.length > 0 && group.tables.every((t) => this.selected().includes(t));
  }

  isGroupPartiallySelected(group: IBackupTableGroup): boolean {
    const selectedCount = group.tables.filter((t) => this.selected().includes(t)).length;
    return selectedCount > 0 && selectedCount < group.tables.length;
  }

  toggleGroup(group: IBackupTableGroup, event: MatCheckboxChange): void {
    const current = new Set(this.selected());
    if (event.checked) {
      group.tables.forEach((t) => current.add(t));
    } else {
      group.tables.forEach((t) => current.delete(t));
    }
    this.selectedChange.emit(this.allTables().filter((t) => current.has(t)));
  }

  toggleTable(table: string, event: MatCheckboxChange): void {
    const current = new Set(this.selected());
    if (event.checked) {
      current.add(table);
    } else {
      current.delete(table);
    }
    this.selectedChange.emit(this.allTables().filter((t) => current.has(t)));
  }
}
