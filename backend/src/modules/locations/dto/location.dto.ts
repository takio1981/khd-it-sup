import { z } from 'zod';

export const createBuildingSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
});
export type CreateBuildingDto = z.infer<typeof createBuildingSchema>;

export const updateBuildingSchema = z.object({
  name: z.string().min(1).max(150).optional(),
});
export type UpdateBuildingDto = z.infer<typeof updateBuildingSchema>;

export const createFloorSchema = z.object({
  buildingId: z.string().uuid('buildingId ต้องเป็น UUID'),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
});
export type CreateFloorDto = z.infer<typeof createFloorSchema>;

export const updateFloorSchema = z.object({
  name: z.string().min(1).max(150).optional(),
});
export type UpdateFloorDto = z.infer<typeof updateFloorSchema>;

export const createRoomSchema = z.object({
  floorId: z.string().uuid('floorId ต้องเป็น UUID'),
  departmentId: z.string().uuid().optional(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
});
export type CreateRoomDto = z.infer<typeof createRoomSchema>;

export const updateRoomSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  departmentId: z.string().uuid().nullable().optional(),
});
export type UpdateRoomDto = z.infer<typeof updateRoomSchema>;

export const listFloorsQuerySchema = z.object({ buildingId: z.string().uuid().optional() });
export type ListFloorsQueryDto = z.infer<typeof listFloorsQuerySchema>;

export const listRoomsQuerySchema = z.object({ floorId: z.string().uuid().optional() });
export type ListRoomsQueryDto = z.infer<typeof listRoomsQuerySchema>;

export const locationIdParamSchema = z.object({ id: z.string().uuid('id ต้องเป็น UUID') });
