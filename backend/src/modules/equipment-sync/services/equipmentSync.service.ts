import { randomUUID, randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { Prisma, type AssetCategory, type Department } from '@prisma/client';
import { AssetRepository } from '@modules/assets/repositories/asset.repository';
import { DepartmentRepository } from '@modules/departments/repositories/department.repository';
import { UserRepository } from '@modules/users/repositories/user.repository';
import { fetchEquipmentPage, type IMophEquipmentPage, type IMophEquipmentRecord } from '@infrastructure/moph/mophEquipment.client';
import { runningNumberService } from '@modules/settings/services/runningNumber.service';
import { auditLogService } from '@modules/audit-log/services/auditLog.service';
import { logger } from '@infrastructure/logger/logger';
import { ConflictError } from '@common/errors';
import { env } from '@config/env';
import type { IRequestContext } from '@common/interfaces';
import {
  buildDepartmentIndex,
  composeRemark,
  inferGenderFromName,
  mapStatus,
  normalizeBudgetYear,
  normalizeDate,
  normalizeExternalId,
  normalizePrice,
  normalizeUnitType,
  resolveCategoryCode,
  resolveClassification,
  resolveDepartment,
  slugifyUsername,
  truncateText,
} from '@modules/equipment-sync/utils/equipmentMapper.util';

/** role ที่ user ซึ่งสร้างจากชื่อ owner ใน MOPH จะได้รับ — สิทธิ์ต่ำสุดในระบบ และตั้ง is_active=false อยู่แล้ว จึง login ไม่ได้จนกว่าแอดมินจะเปิดใช้งานเอง */
const OWNER_PLACEHOLDER_ROLE_CODE = 'USER';
const OWNER_PLACEHOLDER_EMAIL_DOMAIN = 'moph-import.local';

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
  /** gov_asset_number ที่สร้างสำเร็จไปแล้วใน run นี้ (ไม่ได้อยู่ใน existingByGovNumber ตอนเริ่ม run เพราะเพิ่งสร้างใหม่) —
   * กันไม่ให้ record ซ้ำตัวถัดไปใน run เดียวกัน (ข้อมูลต้นทางมี gov_asset_number ซ้ำกันจริงราว 30%) เดินหน้าไปทำงาน
   * ที่เสียเปล่า (resolve category/department/สร้าง owner user ใหม่) ก่อนจะไปชน unique constraint แล้วถูกนับเป็น skip อยู่ดี */
  createdThisRun: Set<string>;
  unmatchedDepartmentCounts: Map<string, number>;
  /** ชื่อเต็ม (trim แล้ว) -> userId — preload จาก user ทุกคนที่มีอยู่แล้ว (รวม placeholder จาก sync รอบก่อน) แล้วเติมเพิ่มระหว่าง run เมื่อสร้างใหม่ กันสร้างซ้ำเมื่อ owner คนเดียวกันปรากฏหลายแถว */
  ownerUserIndex: Map<string, string>;
  /** username ที่ถูกใช้แล้วทั้งหมด (ของเดิม + ที่เพิ่งสร้างใน run นี้) — เช็คการชนกันแบบในหน่วยความจำ ไม่ query DB ซ้ำ */
  usedUsernames: Set<string>;
  ownerRoleId: string | null;
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
  private readonly userRepo = new UserRepository();

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
      const [categories, departments, existingAssets, ownerRole, existingUsers] = await Promise.all([
        this.assetRepo.listCategories(),
        this.departmentRepo.findAll(),
        this.assetRepo.findAllWithGovAssetNumber(),
        this.userRepo.findRoleByCode(OWNER_PLACEHOLDER_ROLE_CODE),
        this.userRepo.findAllForOwnerMatch(),
      ]);

      if (!ownerRole) {
        logger.warn(`[equipment-sync] ไม่พบ role '${OWNER_PLACEHOLDER_ROLE_CODE}' ในระบบ — จะไม่สร้าง/ผูก user จากชื่อ owner ให้ครุภัณฑ์ที่สร้างใหม่ใน run นี้`);
      }

      const runCtx: IRunContext = {
        categoryIndex: new Map(categories.map((c) => [c.code, c])),
        departmentIndex: buildDepartmentIndex(departments),
        existingByGovNumber: new Map(existingAssets.map((a) => [a.govAssetNumber as string, a])),
        createdThisRun: new Set(),
        unmatchedDepartmentCounts: new Map(),
        ownerUserIndex: new Map(existingUsers.map((u) => [u.fullName.trim(), u.id])),
        usedUsernames: new Set(existingUsers.map((u) => u.username)),
        ownerRoleId: ownerRole?.id ?? null,
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
    const { categoryIndex, departmentIndex, existingByGovNumber, createdThisRun, unmatchedDepartmentCounts, ctx, summary } = runCtx;

    try {
      const govAssetNumber = record.equip_no_full?.trim();
      if (!govAssetNumber) {
        summary.skipped += 1;
        return;
      }

      // gov_asset_number นี้สร้างไปแล้วก่อนหน้าใน run เดียวกัน (ข้อมูลต้นทางซ้ำกันเอง) — ข้ามทันทีไม่ต้อง resolve
      // category/department/owner ซ้ำอีกรอบ (จะไปชน unique constraint แล้วถูกนับเป็น skip อยู่ดี แค่ทำงานฟรีก่อนถึงจุดนั้น)
      if (!existingByGovNumber.has(govAssetNumber) && createdThisRun.has(govAssetNumber)) {
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
        // resolve owner ตอนสร้างครั้งแรกเท่านั้น (เหมือน category/department) — กัน sync รอบถัดไปทับ owner ที่แอดมินแก้ไขเองภายหลัง
        const ownerUserId = await this.resolveOwnerUserId(record.owner, runCtx);
        try {
          await this.assetRepo.createMinimal({
            id: randomUUID(),
            assetNumber,
            govAssetNumber,
            categoryId: category.id,
            departmentId,
            ownerUserId,
            externalSource: EXTERNAL_SOURCE,
            externalSyncedAt: now,
            createdBy: ctx?.user.id ?? null,
            ...mappedFields,
          });
          summary.created += 1;
          createdThisRun.add(govAssetNumber);
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

  /**
   * จับคู่ owner (ชื่อ-สกุลข้อความอิสระจาก MOPH) กับ user ที่มีอยู่แล้วก่อนเสมอ (เทียบชื่อเต็ม trim ตรงตัว — ถ้าเป็น
   * staff จริงที่มีบัญชีอยู่แล้วจะได้ผูกกับบัญชีเดิม ไม่สร้างซ้ำ) ถ้าไม่พบให้สร้าง user ใหม่แบบ placeholder:
   * is_active=false + รหัสผ่านสุ่มทิ้ง (login ไม่ได้จนกว่าแอดมินจะเปิดใช้งาน/รีเซ็ตรหัสผ่านเอง), ไม่ระบุ department
   * (owner คนเดียวอาจเป็นเจ้าของครุภัณฑ์คนละหน่วยงานกัน ไม่มีค่าที่ถูกต้องเดียวให้เดา)
   */
  private async resolveOwnerUserId(rawOwner: string | null, runCtx: IRunContext): Promise<string | null> {
    const fullName = rawOwner?.trim();
    if (!fullName || !runCtx.ownerRoleId) return null;

    const existingId = runCtx.ownerUserIndex.get(fullName);
    if (existingId) return existingId;

    const username = this.pickAvailableUsername(fullName, runCtx.usedUsernames);
    const passwordHash = await bcrypt.hash(randomBytes(24).toString('base64url'), env.BCRYPT_SALT_ROUNDS);

    try {
      const user = await this.userRepo.createMinimal({
        id: randomUUID(),
        username,
        email: `${username}@${OWNER_PLACEHOLDER_EMAIL_DOMAIN}`,
        passwordHash,
        fullName,
        gender: inferGenderFromName(fullName),
        roleId: runCtx.ownerRoleId,
        isActive: false,
        mustChangePassword: true,
      });
      runCtx.ownerUserIndex.set(fullName, user.id);
      runCtx.usedUsernames.add(username);
      return user.id;
    } catch (err) {
      logger.warn(`[equipment-sync] สร้าง user จากชื่อ owner "${fullName}" ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)} — ข้าม ownerUserId ให้ครุภัณฑ์นี้`);
      return null;
    }
  }

  private pickAvailableUsername(fullName: string, usedUsernames: Set<string>): string {
    const base = slugifyUsername(fullName);
    if (!usedUsernames.has(base)) return base;

    let suffix = 2;
    let candidate = `${base}${suffix}`;
    while (usedUsernames.has(candidate)) {
      suffix += 1;
      candidate = `${base}${suffix}`;
    }
    return candidate;
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
