import type { Request, Response } from 'express';
import { LocationService } from '@modules/locations/services/location.service';
import type {
  CreateBuildingDto,
  CreateFloorDto,
  CreateRoomDto,
  ListFloorsQueryDto,
  ListRoomsQueryDto,
  UpdateBuildingDto,
  UpdateFloorDto,
  UpdateRoomDto,
} from '@modules/locations/dto/location.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendCreated, sendSuccess } from '@common/utils/apiResponse';
import type { IRequestContext } from '@common/interfaces';

const locationService = new LocationService();

function contextOf(req: Request): IRequestContext {
  return { user: req.user!, ipAddress: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? 'unknown' };
}

export const listBuildings = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await locationService.listBuildings());
});

export const createBuilding = asyncHandler(async (req: Request, res: Response) => {
  const building = await locationService.createBuilding(req.body as CreateBuildingDto, contextOf(req));
  sendCreated(res, building);
});

export const updateBuilding = asyncHandler(async (req: Request, res: Response) => {
  const building = await locationService.updateBuilding(req.params.id, req.body as UpdateBuildingDto, contextOf(req));
  sendSuccess(res, building);
});

export const deleteBuilding = asyncHandler(async (req: Request, res: Response) => {
  await locationService.removeBuilding(req.params.id, contextOf(req));
  sendSuccess(res, { message: 'ลบอาคารสำเร็จ' });
});

export const listFloors = asyncHandler(async (req: Request, res: Response) => {
  const { buildingId } = req.query as unknown as ListFloorsQueryDto;
  sendSuccess(res, await locationService.listFloors(buildingId));
});

export const createFloor = asyncHandler(async (req: Request, res: Response) => {
  const floor = await locationService.createFloor(req.body as CreateFloorDto, contextOf(req));
  sendCreated(res, floor);
});

export const updateFloor = asyncHandler(async (req: Request, res: Response) => {
  const floor = await locationService.updateFloor(req.params.id, req.body as UpdateFloorDto, contextOf(req));
  sendSuccess(res, floor);
});

export const deleteFloor = asyncHandler(async (req: Request, res: Response) => {
  await locationService.removeFloor(req.params.id, contextOf(req));
  sendSuccess(res, { message: 'ลบชั้นสำเร็จ' });
});

export const listRooms = asyncHandler(async (req: Request, res: Response) => {
  const { floorId } = req.query as unknown as ListRoomsQueryDto;
  sendSuccess(res, await locationService.listRooms(floorId));
});

export const createRoom = asyncHandler(async (req: Request, res: Response) => {
  const room = await locationService.createRoom(req.body as CreateRoomDto, contextOf(req));
  sendCreated(res, room);
});

export const updateRoom = asyncHandler(async (req: Request, res: Response) => {
  const room = await locationService.updateRoom(req.params.id, req.body as UpdateRoomDto, contextOf(req));
  sendSuccess(res, room);
});

export const deleteRoom = asyncHandler(async (req: Request, res: Response) => {
  await locationService.removeRoom(req.params.id, contextOf(req));
  sendSuccess(res, { message: 'ลบห้องสำเร็จ' });
});
