import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { getStatusColor, getStatusLabel } from '../../../core/constants/status.const';
import { IconComponent } from '../icon/icon.component';
import { AttachmentThumbnailComponent } from '../attachment-thumbnail/attachment-thumbnail.component';
import type { ITimelineEvent } from '../../../core/models/repair-ticket.model';

const EVENT_ICON: Record<string, string> = {
  SUBMIT: 'paper-airplane',
  RECEIVE: 'clipboard-document-list',
  ASSIGN: 'users',
  STATUS_CHANGE: 'arrow-path',
  ATTACHMENT: 'paper-clip',
  COMMENT: 'chat-bubble-left-right',
  CANCEL: 'x-circle',
  CLOSE: 'check-circle',
};

function formatDuration(seconds: number | null): string | null {
  if (seconds === null) return null;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs === 0 && mins === 0) return 'ไม่ถึง 1 นาที';
  const parts: string[] = [];
  if (hrs > 0) parts.push(`${hrs} ชม.`);
  if (mins > 0) parts.push(`${mins} นาที`);
  return parts.join(' ');
}

/** Vertical Timeline (Material Design style) — แสดงทุก event ของงานซ่อมแบบ immutable ledger ตามสเปกข้อ 37 */
@Component({
  selector: 'khd-timeline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, IconComponent, AttachmentThumbnailComponent],
  templateUrl: './timeline.component.html',
})
export class TimelineComponent {
  readonly events = input.required<ITimelineEvent[]>();

  readonly rows = computed(() =>
    this.events().map((e) => ({
      event: e,
      icon: EVENT_ICON[e.eventType] ?? 'clock',
      color: getStatusColor(e.currentStatus),
      statusLabel: getStatusLabel(e.currentStatus),
      elapsedLabel: formatDuration(e.elapsedSeconds),
      slaLabel: e.slaRemainingSeconds !== null ? formatDuration(Math.abs(e.slaRemainingSeconds)) : null,
      slaOverdue: (e.slaRemainingSeconds ?? 0) < 0,
    })),
  );
}
