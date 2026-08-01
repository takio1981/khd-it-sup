export interface INotificationSettings {
  emailEnabled: boolean;
  telegramEnabled: boolean;
  telegramChatId: string;
  telegramBotTokenConfigured: boolean;
  lineEnabled: boolean;
  lineTargetId: string;
  lineAccessTokenConfigured: boolean;
  notifyNewTicket: boolean;
  notifyAssign: boolean;
  notifyStatusChange: boolean;
  notifyComplete: boolean;
  notifyCancel: boolean;
  notifyAssetBorrowed: boolean;
  notifyAssetReturned: boolean;
  notifyAssetOverdue: boolean;
}

export interface IUpdateNotificationSettingsPayload {
  emailEnabled?: boolean;
  telegramEnabled?: boolean;
  telegramChatId?: string;
  telegramBotToken?: string;
  lineEnabled?: boolean;
  lineTargetId?: string;
  lineAccessToken?: string;
  notifyNewTicket?: boolean;
  notifyAssign?: boolean;
  notifyStatusChange?: boolean;
  notifyComplete?: boolean;
  notifyCancel?: boolean;
  notifyAssetBorrowed?: boolean;
  notifyAssetReturned?: boolean;
  notifyAssetOverdue?: boolean;
}
