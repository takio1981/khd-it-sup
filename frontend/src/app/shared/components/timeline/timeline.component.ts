import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { getStatusColor, getStatusLabel } from '../../../core/constants/status.const';
import { IconComponent } from '../icon/icon.component';
import { AttachmentThumbnailComponent } from '../attachment-thumbnail/attachment-thumbnail.component';
import type { ITimelineAttachment, ITimelineEvent } from '../../../core/models/repair-ticket.model';

export interface ITicketAttachmentRef {
  fileUrl: string;
  fileType: string | null;
  uploadedAt: string;
}

/** event เก่าก่อนมี attachmentUrls จะมีแค่ attachmentUrl เดี่ยว — จับคู่กับไฟล์แนบจริงของ ticket ด้วยเวลาที่ใกล้กัน
 *  (ไฟล์ที่แนบพร้อมกันใน request เดียวจะมี uploadedAt ห่างกันแค่หลักมิลลิวินาที) เพื่อกู้คืนไฟล์ที่เหลือมาแสดงด้วย */
const CORRELATION_WINDOW_MS = 5000;

function resolveEventAttachments(event: ITimelineEvent, allAttachments: ITicketAttachmentRef[]): ITimelineAttachment[] {
  if (event.attachmentUrls && event.attachmentUrls.length > 0) return event.attachmentUrls;
  if (event.eventType !== 'ATTACHMENT' || !event.attachmentUrl) return [];

  const eventMs = new Date(event.eventTime).getTime();
  const correlated = allAttachments.filter((a) => Math.abs(new Date(a.uploadedAt).getTime() - eventMs) <= CORRELATION_WINDOW_MS);
  if (correlated.length > 0) return correlated.map((a) => ({ fileUrl: a.fileUrl, fileType: a.fileType }));

  return [{ fileUrl: event.attachmentUrl, fileType: null }];
}

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
  /** ไฟล์แนบทั้งหมดของ ticket — ใช้จับคู่ย้อนหลังกับ event เก่าที่ยังไม่มี attachmentUrls */
  readonly attachments = input<ITicketAttachmentRef[]>([]);

  readonly rows = computed(() => {
    const allAttachments = this.attachments();
    return this.events().map((e) => ({
      event: e,
      icon: EVENT_ICON[e.eventType] ?? 'clock',
      color: getStatusColor(e.currentStatus),
      statusLabel: getStatusLabel(e.currentStatus),
      elapsedLabel: formatDuration(e.elapsedSeconds),
      slaLabel: e.slaRemainingSeconds !== null ? formatDuration(Math.abs(e.slaRemainingSeconds)) : null,
      slaOverdue: (e.slaRemainingSeconds ?? 0) < 0,
      displayAttachments: resolveEventAttachments(e, allAttachments),
    }));
  });
}
