import { WorkflowRepository } from '@modules/workflow/repositories/workflow.repository';
import { NotFoundError, ConflictError } from '@common/errors';
import type { PrismaClientOrTx } from '@infrastructure/database/prisma';
import { prisma } from '@infrastructure/database/prisma';
import type { WorkflowInstance, WorkflowStep } from '@prisma/client';

export interface IWorkflowInitResult {
  instance: WorkflowInstance;
  step: WorkflowStep;
}

export interface IWorkflowTransitionResult {
  instance: WorkflowInstance;
  fromStep: WorkflowStep;
  toStep: WorkflowStep;
}

/**
 * Workflow Engine หลัก — Configurable State Machine (สเปกข้อ 37)
 * ไม่ผูกกับ Repair Ticket โดยตรง เพื่อให้นำ template อื่นมาใช้ในอนาคตได้ (เช่น Purchase Approval)
 */
export class WorkflowService {
  private readonly repo = new WorkflowRepository();

  async getTemplateStructure(code: string) {
    const template = await this.repo.findTemplateStructure(code);
    if (!template) throw new NotFoundError(`ไม่พบ workflow template: ${code}`);
    return template;
  }

  /** เริ่มต้น workflow instance ใหม่ให้ entity (เช่น repair ticket ที่เพิ่งสร้าง) โดยเดินไปยัง step แรกสุด (fromStepId = null) */
  async initWorkflow(templateCode: string, entityId: string, db: PrismaClientOrTx = prisma): Promise<IWorkflowInitResult> {
    const template = await this.repo.findActiveTemplateByCode(templateCode, db);
    if (!template) throw new NotFoundError(`ไม่พบ workflow template ที่ใช้งานอยู่: ${templateCode}`);

    const initialTransition = template.transitions.find((t) => t.fromStepId === null);
    if (!initialTransition) throw new ConflictError(`workflow template ${templateCode} ไม่มี step เริ่มต้นที่กำหนดไว้`);

    const initialStep = template.steps.find((s) => s.id === initialTransition.toStepId);
    if (!initialStep) throw new ConflictError(`workflow template ${templateCode} มีข้อมูลไม่สอดคล้องกัน (step เริ่มต้นหาย)`);

    const instance = await this.repo.createInstance(
      { templateId: template.id, entityId, currentStepId: initialStep.id },
      db,
    );

    return { instance, step: initialStep };
  }

  /**
   * ย้าย workflow instance ไปยัง step เป้าหมายตามชื่อ step code — ต้องมี transition ที่ประกาศไว้จาก step ปัจจุบันเท่านั้น
   * (deny-by-default: ป้องกันการข้ามขั้นตอนที่ไม่ได้ config ไว้ เช่น SUBMITTED -> COMPLETED ตรง ๆ)
   */
  async transition(
    instanceId: string,
    toStepCode: string,
    conditionKey: string | undefined,
    db: PrismaClientOrTx = prisma,
  ): Promise<IWorkflowTransitionResult> {
    const instance = await this.repo.findInstanceById(instanceId, db);
    if (!instance) throw new NotFoundError('ไม่พบ workflow instance');

    const fromStep = instance.currentStep;
    const toStep = await this.repo.findStepByCode(instance.templateId, toStepCode, db);
    if (!toStep) throw new NotFoundError(`ไม่พบ step "${toStepCode}" ใน workflow template นี้`);

    const validTransition = await this.repo.findTransition(instance.templateId, fromStep.id, toStep.id, conditionKey, db);
    if (!validTransition) {
      throw new ConflictError(
        `ไม่สามารถเปลี่ยนสถานะจาก "${fromStep.stepNameTh}" ไปยัง "${toStep.stepNameTh}" ได้ (ไม่มีเส้นทางนี้ใน workflow)`,
      );
    }

    const updatedInstance = await this.repo.updateInstanceStep(
      instanceId,
      {
        currentStepId: toStep.id,
        ...(toStep.isTerminal ? { status: 'COMPLETED', completedAt: new Date() } : {}),
      },
      db,
    );

    return { instance: updatedInstance, fromStep, toStep };
  }

  async getAvailableTransitions(instanceId: string, db: PrismaClientOrTx = prisma) {
    const instance = await this.repo.findInstanceById(instanceId, db);
    if (!instance) throw new NotFoundError('ไม่พบ workflow instance');
    return this.repo.findAvailableTransitions(instance.templateId, instance.currentStepId, db);
  }
}

export const workflowService = new WorkflowService();
