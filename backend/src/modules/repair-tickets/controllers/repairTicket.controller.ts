import type { Request, Response } from 'express';
import { repairTicketService } from '@modules/repair-tickets/services/repairTicket.service';
import type {
  AssignTicketDto,
  CancelTicketDto,
  CommentTicketDto,
  CreateTicketDto,
  InspectionDto,
  ListTicketsQueryDto,
  RepairSummaryDto,
  TransitionTicketDto,
} from '@modules/repair-tickets/dto/repairTicket.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendCreated, sendSuccess } from '@common/utils/apiResponse';
import { BadRequestError } from '@common/errors';
import type { IRequestContext } from '@common/interfaces';

function contextOf(req: Request): IRequestContext {
  return { user: req.user!, ipAddress: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? 'unknown' };
}

export const listTickets = asyncHandler(async (req: Request, res: Response) => {
  const result = await repairTicketService.list(req.query as unknown as ListTicketsQueryDto, contextOf(req));
  sendSuccess(res, result.items, 200, result.meta);
});

export const getTicket = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await repairTicketService.getById(req.params.id, contextOf(req));
  sendSuccess(res, ticket);
});

export const getTicketTimeline = asyncHandler(async (req: Request, res: Response) => {
  const timeline = await repairTicketService.getTimeline(req.params.id, contextOf(req));
  sendSuccess(res, timeline);
});

export const createTicket = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await repairTicketService.create(req.body as CreateTicketDto, contextOf(req));
  sendCreated(res, ticket);
});

export const receiveTicket = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await repairTicketService.receive(req.params.id, contextOf(req));
  sendSuccess(res, ticket);
});

export const assignTicket = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await repairTicketService.assign(req.params.id, req.body as AssignTicketDto, contextOf(req));
  sendSuccess(res, ticket);
});

export const transitionTicket = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await repairTicketService.transition(req.params.id, req.body as TransitionTicketDto, contextOf(req));
  sendSuccess(res, ticket);
});

export const cancelTicket = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body as CancelTicketDto;
  const ticket = await repairTicketService.cancel(req.params.id, reason, contextOf(req));
  sendSuccess(res, ticket);
});

export const closeTicket = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await repairTicketService.close(req.params.id, contextOf(req));
  sendSuccess(res, ticket);
});

export const commentOnTicket = asyncHandler(async (req: Request, res: Response) => {
  const event = await repairTicketService.addComment(req.params.id, req.body as CommentTicketDto, contextOf(req));
  sendCreated(res, event);
});

export const updateRepairSummary = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await repairTicketService.updateRepairSummary(req.params.id, req.body as RepairSummaryDto, contextOf(req));
  sendSuccess(res, ticket);
});

export const approveUnitHead = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await repairTicketService.approveUnitHead(req.params.id, contextOf(req));
  sendSuccess(res, ticket);
});

export const recordInspection = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await repairTicketService.recordInspection(req.params.id, req.body as InspectionDto, contextOf(req));
  sendSuccess(res, ticket);
});

export const approveDigitalHealthHead = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await repairTicketService.approveDigitalHealthHead(req.params.id, contextOf(req));
  sendSuccess(res, ticket);
});

export const uploadTicketAttachments = asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files?.length) {
    throw new BadRequestError('กรุณาแนบไฟล์อย่างน้อย 1 ไฟล์');
  }
  const attachments = await repairTicketService.addAttachments(req.params.id, files, contextOf(req));
  sendCreated(res, attachments);
});
