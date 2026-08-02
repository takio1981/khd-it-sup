import { randomUUID } from 'node:crypto';
import { prisma } from '@infrastructure/database/prisma';

export class SystemSettingRepository {
  async findByCategory(category: string) {
    return prisma.systemSetting.findMany({ where: { category } });
  }

  async findByCategories(categories: string[]) {
    return prisma.systemSetting.findMany({ where: { category: { in: categories } } });
  }

  async upsert(settingKey: string, settingValue: string, category: string, updatedBy?: string, isSecret = false) {
    return prisma.systemSetting.upsert({
      where: { settingKey },
      create: { id: randomUUID(), settingKey, settingValue, category, updatedBy, isSecret },
      update: { settingValue, updatedBy, isSecret },
    });
  }
}
