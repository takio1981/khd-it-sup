import { Router } from 'express';
import * as locationController from '@modules/locations/controllers/location.controller';
import {
  createBuildingSchema,
  createFloorSchema,
  createRoomSchema,
  listFloorsQuerySchema,
  listRoomsQuerySchema,
  locationIdParamSchema,
  updateBuildingSchema,
  updateFloorSchema,
  updateRoomSchema,
} from '@modules/locations/dto/location.dto';
import { authenticate, requirePermission, validateRequest } from '@common/middleware';
import { PERMISSIONS } from '@common/constants/permissions.const';

const router = Router();
router.use(authenticate);

/**
 * @openapi
 * /buildings:
 *   get:
 *     tags: [Locations]
 *     summary: รายชื่ออาคารทั้งหมด
 *     security: [{ bearerAuth: [] }]
 */
router.get('/buildings', locationController.listBuildings);
router.post(
  '/buildings',
  requirePermission(PERMISSIONS.ASSET_CREATE),
  validateRequest({ body: createBuildingSchema }),
  locationController.createBuilding,
);
router.patch(
  '/buildings/:id',
  requirePermission(PERMISSIONS.ASSET_UPDATE),
  validateRequest({ params: locationIdParamSchema, body: updateBuildingSchema }),
  locationController.updateBuilding,
);
router.delete(
  '/buildings/:id',
  requirePermission(PERMISSIONS.ASSET_DELETE),
  validateRequest({ params: locationIdParamSchema }),
  locationController.deleteBuilding,
);

/**
 * @openapi
 * /floors:
 *   get:
 *     tags: [Locations]
 *     summary: รายชื่อชั้นทั้งหมด (กรองตามอาคารได้ผ่าน ?buildingId=)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/floors', validateRequest({ query: listFloorsQuerySchema }), locationController.listFloors);
router.post(
  '/floors',
  requirePermission(PERMISSIONS.ASSET_CREATE),
  validateRequest({ body: createFloorSchema }),
  locationController.createFloor,
);
router.patch(
  '/floors/:id',
  requirePermission(PERMISSIONS.ASSET_UPDATE),
  validateRequest({ params: locationIdParamSchema, body: updateFloorSchema }),
  locationController.updateFloor,
);
router.delete(
  '/floors/:id',
  requirePermission(PERMISSIONS.ASSET_DELETE),
  validateRequest({ params: locationIdParamSchema }),
  locationController.deleteFloor,
);

/**
 * @openapi
 * /rooms:
 *   get:
 *     tags: [Locations]
 *     summary: รายชื่อห้องทั้งหมด (กรองตามชั้นได้ผ่าน ?floorId=)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/rooms', validateRequest({ query: listRoomsQuerySchema }), locationController.listRooms);
router.post(
  '/rooms',
  requirePermission(PERMISSIONS.ASSET_CREATE),
  validateRequest({ body: createRoomSchema }),
  locationController.createRoom,
);
router.patch(
  '/rooms/:id',
  requirePermission(PERMISSIONS.ASSET_UPDATE),
  validateRequest({ params: locationIdParamSchema, body: updateRoomSchema }),
  locationController.updateRoom,
);
router.delete(
  '/rooms/:id',
  requirePermission(PERMISSIONS.ASSET_DELETE),
  validateRequest({ params: locationIdParamSchema }),
  locationController.deleteRoom,
);

export default router;
