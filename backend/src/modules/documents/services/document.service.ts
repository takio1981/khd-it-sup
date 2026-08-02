import { DocumentRepository } from '@modules/documents/repositories/document.repository';
import type { GenerateDocumentDto, ListDocumentsQueryDto } from '@modules/documents/dto/document.dto';
import { runningNumberService } from '@modules/settings/services/runningNumber.service';
import { NotFoundError, BadRequestError } from '@common/errors';
import { normalizePagination, buildPaginatedResult } from '@common/utils/pagination';
import { auditLogService } from '@modules/audit-log/services/auditLog.service';
import type { IRequestContext } from '@common/interfaces';

export class DocumentService {
  private readonly repo = new DocumentRepository();

  async listTemplates() {
    return this.repo.findActiveTemplates();
  }

  async list(query: ListDocumentsQueryDto) {
    const pagination = normalizePagination(query);
    const { items, total } = await this.repo.findManyGenerated({ ticketId: query.ticketId, templateCode: query.templateCode }, pagination);
    return buildPaginatedResult(items, total, pagination);
  }

  /** ออกเลขที่เอกสารจริงจาก running_number_sequences (docType = templateCode) แล้วบันทึกไฟล์ที่ frontend render มาแล้วเป็นหลักฐาน */
  async generate(dto: GenerateDocumentDto, fileUrl: string, ctx: IRequestContext) {
    const template = await this.repo.findTemplateByCode(dto.templateCode);
    if (!template || !template.isActive) {
      throw new BadRequestError(`ไม่พบแบบฟอร์มเอกสารรหัส "${dto.templateCode}" หรือถูกปิดใช้งานแล้ว`);
    }

    let runningNumber: string;
    try {
      runningNumber = await runningNumberService.getNextNumber(dto.templateCode);
    } catch (err) {
      if (err instanceof NotFoundError) {
        throw new BadRequestError(`แบบฟอร์ม "${dto.templateCode}" ยังไม่ได้ตั้งค่าเลขที่วิ่งอัตโนมัติ (running_number_sequences)`);
      }
      throw err;
    }

    const doc = await this.repo.createGenerated({
      ticketId: dto.ticketId,
      templateCode: dto.templateCode,
      runningNumber,
      fileUrl,
      generatedBy: ctx.user.id,
    });

    await auditLogService.record(
      {
        action: 'PRINT',
        module: 'document',
        entityType: 'GeneratedDocument',
        entityId: doc.id,
        description: `ออกเอกสาร ${template.nameTh} เลขที่ ${runningNumber}${doc.ticket ? ` (ใบแจ้งซ่อม ${doc.ticket.ticketNumber})` : ''}`,
      },
      ctx,
    );

    return doc;
  }
}

export const documentService = new DocumentService();
