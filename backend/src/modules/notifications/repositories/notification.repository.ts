import { randomUUID } from 'node:crypto';
import type { NotificationChannel, NotificationStatus, Prisma } from '@prisma/client';
import { prisma } from '@infrastructure/database/prisma';

export class NotificationRepository {
  async create(data: {
    channel: NotificationChannel;
    recipient: string;
    subject?: string;
    message: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }) {
    return prisma.notificationLog.create({ data: { id: randomUUID(), status: 'PENDING', ...data } });
  }

  async markSent(id: string) {
    return prisma.notificationLog.update({ where: { id }, data: { status: 'SENT', sentAt: new Date() } });
  }

  async markFailed(id: string, errorMessage: string) {
    return prisma.notificationLog.update({ where: { id }, data: { status: 'FAILED', errorMessage } });
  }

  async findMany(where: Prisma.NotificationLogWhereInput, skip: number, take: number) {
    const [items, total] = await Promise.all([
      prisma.notificationLog.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.notificationLog.count({ where }),
    ]);
    return { items, total };
  }

  async updateStatus(id: string, status: NotificationStatus) {
    return prisma.notificationLog.update({ where: { id }, data: { status } });
  }

  /** แจ้งเตือนในแอป (bell) ของผู้ใช้คนหนึ่ง — recipient เก็บ userId แทนอีเมล/chat id สำหรับ channel="PUSH" */
  async findManyForUser(userId: string, skip: number, take: number) {
    const where: Prisma.NotificationLogWhereInput = { channel: 'PUSH', recipient: userId };
    const [items, total] = await Promise.all([
      prisma.notificationLog.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.notificationLog.count({ where }),
    ]);
    return { items, total };
  }

  async countUnreadForUser(userId: string): Promise<number> {
    return prisma.notificationLog.count({ where: { channel: 'PUSH', recipient: userId, readAt: null } });
  }

  async markReadForUser(userId: string, id: string): Promise<void> {
    await prisma.notificationLog.updateMany({ where: { id, channel: 'PUSH', recipient: userId, readAt: null }, data: { readAt: new Date() } });
  }

  async markAllReadForUser(userId: string): Promise<void> {
    await prisma.notificationLog.updateMany({ where: { channel: 'PUSH', recipient: userId, readAt: null }, data: { readAt: new Date() } });
  }
}
