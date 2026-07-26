import { randomUUID } from 'node:crypto';
import type { Prisma, WorkflowAppliesTo } from '@prisma/client';
import { prisma, type PrismaClientOrTx } from '@infrastructure/database/prisma';

export class WorkflowRepository {
  async findActiveTemplateByCode(code: string, db: PrismaClientOrTx = prisma) {
    return db.workflowTemplate.findFirst({
      where: { code, isActive: true },
      orderBy: { version: 'desc' },
      include: { steps: { orderBy: { stepOrder: 'asc' } }, transitions: true },
    });
  }

  async findStepById(id: string, db: PrismaClientOrTx = prisma) {
    return db.workflowStep.findUnique({ where: { id } });
  }

  async findStepByCode(templateId: string, stepCode: string, db: PrismaClientOrTx = prisma) {
    return db.workflowStep.findUnique({ where: { templateId_stepCode: { templateId, stepCode } } });
  }

  /** หา transition ที่ถูกต้องจาก step ปัจจุบันไปยัง step ปลายทาง (ตรวจ conditionKey ถ้ามีมากกว่า 1 ทางเลือก) */
  async findTransition(
    templateId: string,
    fromStepId: string | null,
    toStepId: string,
    conditionKey: string | null | undefined,
    db: PrismaClientOrTx = prisma,
  ) {
    return db.workflowTransition.findFirst({
      where: {
        templateId,
        fromStepId,
        toStepId,
        ...(conditionKey ? { conditionKey } : {}),
      },
    });
  }

  async findAvailableTransitions(templateId: string, fromStepId: string, db: PrismaClientOrTx = prisma) {
    return db.workflowTransition.findMany({
      where: { templateId, fromStepId },
      include: { toStep: true },
    });
  }

  async createInstance(
    data: { templateId: string; entityId: string; currentStepId: string },
    db: PrismaClientOrTx = prisma,
  ) {
    return db.workflowInstance.create({
      data: {
        id: randomUUID(),
        templateId: data.templateId,
        entityType: 'REPAIR_TICKET',
        entityId: data.entityId,
        currentStepId: data.currentStepId,
      },
    });
  }

  async findInstanceById(id: string, db: PrismaClientOrTx = prisma) {
    return db.workflowInstance.findUnique({ where: { id }, include: { currentStep: true, template: true } });
  }

  async updateInstanceStep(
    id: string,
    data: Prisma.WorkflowInstanceUncheckedUpdateInput,
    db: PrismaClientOrTx = prisma,
  ) {
    return db.workflowInstance.update({ where: { id }, data });
  }

  async findTemplateStructure(code: string, db: PrismaClientOrTx = prisma) {
    return db.workflowTemplate.findFirst({
      where: { code, isActive: true },
      orderBy: { version: 'desc' },
      include: {
        steps: { orderBy: { stepOrder: 'asc' }, include: { responsibleRole: { select: { code: true, nameTh: true } } } },
        transitions: true,
      },
    });
  }
}

export type { WorkflowAppliesTo };
