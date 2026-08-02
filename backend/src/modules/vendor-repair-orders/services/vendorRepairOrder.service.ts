import { VendorRepairOrderRepository } from '@modules/vendor-repair-orders/repositories/vendorRepairOrder.repository';
import type { CreateVendorOrderDto, ListVendorOrdersQueryDto, UpdateVendorOrderDto } from '@modules/vendor-repair-orders/dto/vendorRepairOrder.dto';
import { runningNumberService } from '@modules/settings/services/runningNumber.service';
import { repairTicketService } from '@modules/repair-tickets/services/repairTicket.service';
import { NotFoundError } from '@common/errors';
import { normalizePagination, buildPaginatedResult } from '@common/utils/pagination';
import { auditLogService } from '@modules/audit-log/services/auditLog.service';
import { logger } from '@infrastructure/logger/logger';
import type { IRequestContext } from '@common/interfaces';

/** สถานะที่ถือว่า "รับเครื่องคืนแล้วหรือปิดงานแล้ว" — ไม่ต้อง trigger transition ตั๋วซ้ำอีกถ้าเคย RETURNED ไปแล้วครั้งหนึ่ง */
const ALREADY_RETURNED_STATUSES = new Set(['RETURNED', 'INSPECTED', 'COMPLETED', 'CANCELLED']);

export class VendorRepairOrderService {
  private readonly repo = new VendorRepairOrderRepository();

  async list(query: ListVendorOrdersQueryDto) {
    const pagination = normalizePagination(query);
    const { items, total } = await this.repo.findMany({ ticketId: query.ticketId, vendorId: query.vendorId, status: query.status }, pagination);
    return buildPaginatedResult(items, total, pagination);
  }

  async getById(id: string) {
    const order = await this.repo.findById(id);
    if (!order) throw new NotFoundError('ไม่พบใบส่งซ่อมภายนอก');
    return order;
  }

  async create(dto: CreateVendorOrderDto, ctx: IRequestContext) {
    const order = await this.repo.create(dto);
    await auditLogService.record(
      {
        action: 'CREATE',
        module: 'vendor-repair-order',
        entityType: 'VendorRepairOrder',
        entityId: order.id,
        description: `สร้างใบส่งซ่อมภายนอกให้ ${order.ticket.ticketNumber} (ผู้รับซ่อม: ${order.vendor.name})`,
      },
      ctx,
    );
    return order;
  }

  async update(id: string, dto: UpdateVendorOrderDto, ctx: IRequestContext) {
    const existing = await this.getById(id);

    let poNumber = dto.poNumber;
    if (dto.status === 'PO_GENERATED' && !existing.poNumber && !poNumber) {
      poNumber = await runningNumberService.getNextNumber('EXTERNAL_APPROVAL');
    }

    const order = await this.repo.update(id, {
      status: dto.status,
      vendorId: dto.vendorId,
      quotationAmount: dto.quotationAmount,
      poNumber,
      sentAt: dto.sentAt,
      receivedAt: dto.receivedAt,
      warrantyUntil: dto.warrantyUntil,
    });

    await auditLogService.record(
      {
        action: 'UPDATE',
        module: 'vendor-repair-order',
        entityType: 'VendorRepairOrder',
        entityId: id,
        description: `แก้ไขใบส่งซ่อมภายนอกของ ${order.ticket.ticketNumber}${dto.status ? ` (สถานะ: ${dto.status})` : ''}`,
      },
      ctx,
    );

    // รับเครื่องคืนจากร้าน ครั้งแรกเท่านั้น — ย้าย workflow ของตั๋วกลับเข้า TESTING อัตโนมัติ
    if (dto.status === 'RETURNED' && !ALREADY_RETURNED_STATUSES.has(existing.status)) {
      try {
        await repairTicketService.receiveFromVendor(order.ticketId, ctx);
      } catch (err) {
        logger.warn(
          `[vendor-repair-order] รับเครื่องคืนแล้วแต่ย้ายสถานะตั๋ว ${order.ticket.ticketNumber} กลับเข้า TESTING ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return order;
  }

  async setQuotationFile(id: string, fileUrl: string, ctx: IRequestContext) {
    const order = await this.repo.update(id, { quotationFileUrl: fileUrl });
    await auditLogService.record(
      { action: 'UPDATE', module: 'vendor-repair-order', entityType: 'VendorRepairOrder', entityId: id, description: `แนบไฟล์ใบเสนอราคา ${order.ticket.ticketNumber}` },
      ctx,
    );
    return order;
  }

  async setInvoiceFile(id: string, fileUrl: string, ctx: IRequestContext) {
    const order = await this.repo.update(id, { invoiceFileUrl: fileUrl });
    await auditLogService.record(
      { action: 'UPDATE', module: 'vendor-repair-order', entityType: 'VendorRepairOrder', entityId: id, description: `แนบไฟล์ใบแจ้งหนี้/ใบเสร็จ ${order.ticket.ticketNumber}` },
      ctx,
    );
    return order;
  }
}

export const vendorRepairOrderService = new VendorRepairOrderService();
