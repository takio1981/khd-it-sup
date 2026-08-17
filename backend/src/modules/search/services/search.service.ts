import { AssetService } from '@modules/assets/services/asset.service';
import { UserService } from '@modules/users/services/user.service';
import { repairTicketService } from '@modules/repair-tickets/services/repairTicket.service';
import { PERMISSIONS } from '@common/constants/permissions.const';
import type { IRequestContext } from '@common/interfaces';

const RESULT_LIMIT = 5;

const assetService = new AssetService();
const userService = new UserService();

export interface IGlobalSearchResult {
  tickets: Array<{ id: string; ticketNumber: string; description: string; status: string; assetLabel: string | null }>;
  assets: Array<{ id: string; assetNumber: string; label: string; status: string }>;
  users: Array<{ id: string; fullName: string; username: string; email: string | null }>;
}

/** ค้นหาข้ามระบบ (ตั๋วซ่อม/ครุภัณฑ์/ผู้ใช้) — แต่ละประเภทแสดงเฉพาะเมื่อผู้ใช้มีสิทธิ์ดูข้อมูลประเภทนั้นเท่านั้น
 *  โดย reuse list() ของแต่ละโมดูลตรง ๆ เพื่อให้ scoping สิทธิ์ (เช่น ticket:track เห็นเฉพาะของตนเอง) ถูกต้องเสมอ
 *  ไม่ต้อง implement การกรองสิทธิ์ซ้ำเองที่นี่ */
export class SearchService {
  async search(keyword: string, ctx: IRequestContext): Promise<IGlobalSearchResult> {
    const perms = ctx.user.permissions;
    const canTicket = perms.includes(PERMISSIONS.TICKET_READ) || perms.includes(PERMISSIONS.TICKET_TRACK);
    const canAsset = perms.includes(PERMISSIONS.ASSET_READ);
    const canUser = perms.includes(PERMISSIONS.USER_READ);

    const [ticketResult, assetResult, userResult] = await Promise.all([
      canTicket ? repairTicketService.list({ keyword, page: 1, limit: RESULT_LIMIT }, ctx) : null,
      canAsset ? assetService.list({ keyword, page: 1, limit: RESULT_LIMIT }) : null,
      canUser ? userService.list({ keyword, page: 1, limit: RESULT_LIMIT }) : null,
    ]);

    return {
      tickets: (ticketResult?.items ?? []).map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        description: t.description,
        status: t.status,
        assetLabel: t.asset ? [t.asset.brand, t.asset.model].filter(Boolean).join(' ') || t.asset.assetNumber : null,
      })),
      assets: (assetResult?.items ?? []).map((a) => ({
        id: a.id,
        assetNumber: a.assetNumber,
        label: [a.brand, a.model].filter(Boolean).join(' ') || a.assetNumber,
        status: a.status,
      })),
      users: (userResult?.items ?? []).map((u) => ({
        id: u.id,
        fullName: u.fullName,
        username: u.username,
        email: u.email,
      })),
    };
  }
}

export const searchService = new SearchService();
