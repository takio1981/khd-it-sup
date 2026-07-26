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
}
