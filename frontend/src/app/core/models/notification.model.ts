export type NotificationChannel = 'EMAIL' | 'TELEGRAM' | 'LINE' | 'PUSH' | 'SMS';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'READ';

export interface INotificationLog {
  id: string;
  channel: NotificationChannel;
  recipient: string;
  subject: string | null;
  message: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  status: NotificationStatus;
  sentAt: string | null;
  readAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}
