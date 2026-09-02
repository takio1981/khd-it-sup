import { randomUUID } from 'node:crypto';
import { Prisma, type AssetCategory, type Department } from '@prisma/client';
import { AssetRepository } from '@modules/assets/repositories/asset.repository';
import { DepartmentRepository } from '@modules/departments/repositories/department.repository';
import { fetchEquipmentPage, type IMophEquipmentPage, type IMophEquipmentRecord } from '@infrastructure/moph/mophEquipment.client';
import { runningNumberService } from '@modules/settings/services/runningNumber.service';
import { auditLogService } from '@modules/audit-log/services/auditLog.service';
import { logger } from '@infrastructure/logger/logger';
import { ConflictError } from '@common/errors';
import type { IRequestContext } from '@common/interfaces';
import {
  buildDepartmentIndex,
  composeRemark,
  mapStatus,
  normalizeBudgetYear,
  normalizeDate,
  normalizeExternalId,
  normalizePrice,
  normalizeUnitType,
  resolveCategoryCode,
  resolveClassification,
  resolveDepartment,
  truncateText,
} from '@modules/equipment-sync/utils/equipmentMapper.util';

/** เครื่องหมายว่า asset แถวนี้เป็นของ sync นี้ — ใช้กันไม่ให้ re-sync ไปแตะ asset ที่สร้างเองแม้จะบังเอิญมี gov_asset_number ตรงกัน */
const EXTERNAL_SOURCE = 'MOPH_ASSETTRACKER';
const MAX_PAGE_RETRIES = 3;
const MAX_SAMPLE_ERRORS = 50;
/** ถ้าหน้าที่ดึงไม่สำเร็จเกินสัดส่วนนี้ของทั้งหมด ให้หยุด run ไว้ก่อน กันบันทึกผลเป็น "สำเร็จ" ทั้งที่ API ต้นทางล่มไปเกือบหมด */
const ABORT_FAILED_PAGE_RATIO = 0.5;

export type SyncTrigger = 'MANUAL' | 'SCHEDULER';

export interface IEquipmentSyncSummary {
  trigger: SyncTrigger;
  startedAt: string;
  finishedAt: string;
  totalFetched: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  failedPages: number[];
  unmatchedDepartments: Array<{ locationName: string; count: number }>;
  sampleErrors: Array<{ govAssetNumber: string; message: string }>;
  aborted: boolean;
  abortReason?: string;
}

export interface IEquipmentSyncStatus {
  isRunning: boolean;
  currentTrigger: SyncTrigger | null;
  startedAt: string | null;
  lastRun: IEquipmentSyncSummary | null;
}

interface IExistingAssetRef {
  id: string;
  govAssetNumber: string | null;
  deletedAt: Date | null;
  externalSource: string | null;
}

interface IRunContext {
  categoryIndex: Map<string, AssetCategory>;
  departmentIndex: Map<string, Department>;
  existingByGovNumber: Map<string, IExistingAssetRef>;
  unmatchedDepartmentCounts: Map<string, number>;
  ctx?: IRequestContext;
  summary: IEquipmentSyncSummary;
}

interface IRunState {
  isRunning: boolean;
  trigger: SyncTrigger | null;
  startedAt: Date | null;
  lastResult: IEquipmentSyncSummary | null;
}

/**
 * ซิงค์ข้อมูลครุภัณฑ์จาก MOPH AssetTracker API เข้าตาราง assets — ใช้ทั้งจาก cron (scheduler.ts) และปุ่ม
 * "นำเข้าครุภัณฑ์" ในหน้าแอดมิน เรียก executeRun เดียวกัน lock ด้วย in-memory flag (deployment เป็น backend
 * container เดียว ไม่มี replica จึงไม่มีปัญหา lock ค้างข้ามเครื่อง และ reset เองเมื่อ restart)
 */
export class EquipmentSyncService {
  private readonly assetRepo = new AssetRepository();
  private readonly departmentRepo = new DepartmentRepository();

  private readonly state: IRunState = {
    isRunning: false,
    trigger: null,
    startedAt: null,
    lastResult: null,
  };

  getStatus(): IEquipmentSyncStatus {
    return {
      isRunning: this.state.isRunning,
      currentTrigger: this.state.trigger,
      startedAt: this.state.startedAt?.toISOString() ?? null,
      lastRun: this.state.lastResult,
    };
  }

  startManualRun(ctx: IRequestContext): void {
    if (this.state.isRunning) {
      throw new ConflictError('กำลังซิงค์ข้อมูลครุภัณฑ์จากระบบ MOPH อยู่ กรุณารอให้เสร็จก่อน');
    }
    this.lock('MANUAL');
    this.executeRun('MANUAL', ctx).catch((err) => {
      logger.error(`[equipment-sync] การซิงค์ล้มเหลว (manual): ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  startScheduledRun(): void {
    if (this.state.isRunning) {
      logger.warn('[equipment-sync] ข้าม schedule run เพราะมี sync ทำงานอยู่แล้ว');
      return;
    }
    this.lock('SCHEDULER');
    this.executeRun('SCHEDULER').catch((err) => {
      logger.error(`[equipment-sync] การซิงค์ล้มเหลว (scheduled): ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  private lock(trigger: SyncTrigger): void {
    this.state.isRunning = true;
    this.state.trigger = trigger;
    this.state.startedAt = new Date();
  }

  private async executeRun(trigger: SyncTrigger, ctx?: IRequestContext): Promise<void> {
    const startedAt = this.state.startedAt ?? new Date();
    const summary: IEquipmentSyncSummary = {
      trigger,
      startedAt: startedAt.toISOString(),
      finishedAt: '',
      totalFetched: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      failedPages: [],
      unmatchedDepartments: [],
      sampleErrors: [],
      aborted: false,
    };

    try {
      const [categories, departments, existingAssets] = await Promise.all([
        this.assetRepo.listCategories(),
        this.departmentRepo.findAll(),
        this.assetRepo.findAllWithGovAssetNumber(),
      ]);

      const runCtx: IRunContext = {
        categoryIndex: new Map(categories.map((c) => [c.code, c])),
        departmentIndex: buildDepartmentIndex(departments),
        existingByGovNumber: new Map(existingAssets.map((a) => [a.govAssetNumber as string, a])),
        unmatchedDepartmentCounts: new Map(),
        ctx,
        summary,
      };

      const firstPage = await this.fetchPageWithRetry(1, summary);
      if (!firstPage) {
        summary.aborted = true;
        summary.abortReason = 'ดึงข้อมูลหน้าแรกจาก MOPH ไม่สำเร็จ';
      } else {
        const lastPage = firstPage.meta.last_page;
        await this.processPage(firstPage.data, runCtx);

        for (let page = 2; page <= lastPage; page++) {
          if (summary.failedPages.length > lastPage * ABORT_FAILED_PAGE_RATIO) {
            summary.aborted = true;
            summary.abortReason = `หน้าที่ดึงไม่สำเร็จเกิน ${Math.round(ABORT_FAILED_PAGE_RATIO * 100)}% ของทั้งหมด (${summary.failedPages.length}/${lastPage}) — หยุด run นี้ไว้ก่อน`;
            break;
          }
          const pageData = await this.fetchPageWithRetry(page, summary);
          if (!pageData) continue;
          await this.processPage(pageData.data, runCtx);
        }

        summary.unmatchedDepartments = Array.from(runCtx.unmatchedDepartmentCounts.entries())
          .map(([locationName, count]) => ({ locationName, count }))
          .sort((a, b) => b.count - a.count);
      }
    } catch (err) {
      summary.aborted = true;
      summary.abortReason = err instanceof Error ? err.message : String(err);
      logger.error(`[equipment-sync] run ล้มเหลวไม่คาดคิด: ${summary.abortReason}`);
    }

    await this.finish(summary, ctx);
  }

  private async fetchPageWithRetry(page: number, summary: IEquipmentSyncSummary): Promise<IMophEquipmentPage | null> {
    for (let attempt = 1; attempt <= MAX_PAGE_RETRIES; attempt++) {
      try {
        return await fetchEquipmentPage(page);
      } catch (err) {
        logger.warn(
          `[equipment-sync] ดึงหน้า ${page} ล้มเหลว (ครั้งที่ ${attempt}/${MAX_PAGE_RETRIES}): ${err instanceof Error ? err.message : String(err)}`,
        );
        if (attempt < MAX_PAGE_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        }
      }
    }
    summary.failedPages.push(page);
    return null;
  }

  private async processPage(records: IMophEquipmentRecord[], runCtx: IRunContext): Promise<void> {
    for (const record of records) {
      runCtx.summary.totalFetched += 1;
      await this.processRecord(record, runCtx);
    }
  }

  private async processRecord(record: IMophEquipmentRecord, runCtx: IRunContext): Promise<void> {
    const { categoryIndex, departmentIndex, existingByGovNumber, unmatchedDepartmentCounts, ctx, summary } = runCtx;

    try {
      const govAssetNumber = record.equip_no_full?.trim();
      if (!govAssetNumber) {
        summary.skipped += 1;
        return;
      }

      const categoryCode = resolveCategoryCode(record);
      const category = categoryIndex.get(categoryCode) ?? categoryIndex.get('OTHER');
      if (!category) {
        throw new Error(`ไม่พบหมวดหมู่ครุภัณฑ์ '${categoryCode}' หรือ 'OTHER' ในระบบ`);
      }

      const { departmentId, locationNote } = resolveDepartment(record.location_name, departmentIndex);
      if (!departmentId && record.location_name?.trim()) {
        const key = record.location_name.trim();
        unmatchedDepartmentCounts.set(key, (unmatchedDepartmentCounts.get(key) ?? 0) + 1);
      }

      const classification = resolveClassification(record);
      const mappedFields = {
        serialNumber: truncateText(record.serial_no),
        model: truncateText(record.model),
        brand: truncateText(record.brand),
        price: normalizePrice(record.price),
        status: mapStatus(record.status),
        purchaseDate: normalizeDate(record.datetime_in),
        remark: composeRemark(record),
        locationNote,
        externalId: normalizeExternalId(record.id),
        unitType: normalizeUnitType(record.unit_type),
        budgetYear: normalizeBudgetYear(record.budget_year),
        equipClassificationCode: classification.code,
        equipClassificationName: truncateText(classification.name, 150),
      };

      const existing = existingByGovNumber.get(govAssetNumber);
      const now = new Date();

      if (!existing) {
        const assetNumber = await runningNumberService.getNextNumber('ASSET');
        try {
          await this.assetRepo.createMinimal({
            id: randomUUID(),
            assetNumber,
            govAssetNumber,
            categoryId: category.id,
            departmentId,
            externalSource: EXTERNAL_SOURCE,
            externalSyncedAt: now,
            createdBy: ctx?.user.id ?? null,
            ...mappedFields,
          });
          summary.created += 1;
        } catch (err) {
          if (this.isUniqueConstraintError(err)) {
            summary.skipped += 1;
            return;
          }
          throw err;
        }
        return;
      }

      // ถูกลบออกจากระบบท้องถิ่นแล้ว (soft delete) — ไม่ดึงกลับมาอัตโนมัติ
      if (existing.deletedAt) {
        summary.skipped += 1;
        return;
      }

      // ชนกับครุภัณฑ์ที่สร้างเอง (ไม่ใช่ของ sync นี้) — ไม่แก้ไข
      if (existing.externalSource !== EXTERNAL_SOURCE) {
        summary.skipped += 1;
        return;
      }

      // ไม่เขียนทับ categoryId/departmentId ซ้ำทุกครั้ง — เก็บ classification ที่แก้ไขด้วยมือไว้ อัปเดตเฉพาะฟิลด์ที่ผันแปรได้จากต้นทาง
      await this.assetRepo.updateMinimal(existing.id, {
        ...mappedFields,
        externalSyncedAt: now,
        updatedBy: ctx?.user.id ?? null,
      });
      summary.updated += 1;
    } catch (err) {
      summary.failed += 1;
      if (summary.sampleErrors.length < MAX_SAMPLE_ERRORS) {
        summary.sampleErrors.push({
          govAssetNumber: record.equip_no_full ?? String(record.id),
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  private isUniqueConstraintError(err: unknown): boolean {
    return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
  }

  private async finish(summary: IEquipmentSyncSummary, ctx?: IRequestContext): Promise<void> {
    summary.finishedAt = new Date().toISOString();
    this.state.isRunning = false;
    this.state.trigger = null;
    this.state.startedAt = null;
    this.state.lastResult = summary;

    const description =
      `ซิงค์ครุภัณฑ์จาก MOPH (${summary.trigger}): พบ ${summary.totalFetched} รายการ, ` +
      `สร้างใหม่ ${summary.created}, อัปเดต ${summary.updated}, ข้าม ${summary.skipped}, ล้มเหลว ${summary.failed}` +
      (summary.aborted ? ` — หยุดก่อนกำหนด: ${summary.abortReason}` : '');
    logger.info(`[equipment-sync] ${description}`);

    // เขียน audit log แบบสรุป 1 แถวต่อ 1 run เท่านั้น — ไม่เขียนทีละ asset เพราะ 3,000+ แถวทุกคืนจะถล่ม audit log UI
    await auditLogService.record(
      { action: 'IMPORT', module: 'asset', entityType: 'EquipmentSyncRun', description, afterData: summary },
      ctx ?? { user: null, ipAddress: 'system-cron', userAgent: 'equipment-sync-scheduler' },
    );
  }
}

export const equipmentSyncService = new EquipmentSyncService();
