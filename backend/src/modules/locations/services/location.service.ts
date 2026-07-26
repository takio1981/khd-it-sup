import { randomUUID } from 'node:crypto';
import { LocationRepository } from '@modules/locations/repositories/location.repository';
import type {
  CreateBuildingDto,
  CreateFloorDto,
  CreateRoomDto,
  UpdateBuildingDto,
  UpdateFloorDto,
  UpdateRoomDto,
} from '@modules/locations/dto/location.dto';
import { ConflictError, NotFoundError } from '@common/errors';
import { auditLogService } from '@modules/audit-log/services/auditLog.service';
import type { IRequestContext } from '@common/interfaces';

export class LocationService {
  private readonly repo = new LocationRepository();

  // --- Buildings ---
  async listBuildings() {
    return this.repo.findAllBuildings();
  }

  async createBuilding(dto: CreateBuildingDto, ctx: IRequestContext) {
    const existing = await this.repo.findBuildingByCode(dto.code);
    if (existing) throw new ConflictError('รหัสอาคารนี้มีอยู่แล้ว');

    const building = await this.repo.createBuilding({ id: randomUUID(), ...dto });
    await auditLogService.record(
      { action: 'CREATE', module: 'asset', entityType: 'Building', entityId: building.id, description: `สร้างอาคาร ${building.name}` },
      ctx,
    );
    return building;
  }

  async updateBuilding(id: string, dto: UpdateBuildingDto, ctx: IRequestContext) {
    const existing = await this.repo.findBuildingById(id);
    if (!existing) throw new NotFoundError('ไม่พบอาคาร');

    const building = await this.repo.updateBuilding(id, dto);
    await auditLogService.record(
      { action: 'UPDATE', module: 'asset', entityType: 'Building', entityId: id, description: `แก้ไขอาคาร ${building.name}` },
      ctx,
    );
    return building;
  }

  async removeBuilding(id: string, ctx: IRequestContext) {
    const existing = await this.repo.findBuildingById(id);
    if (!existing) throw new NotFoundError('ไม่พบอาคาร');

    const [floorCount, assetCount] = await Promise.all([
      this.repo.countFloorsByBuilding(id),
      this.repo.countAssetsByBuilding(id),
    ]);
    if (floorCount > 0 || assetCount > 0) {
      throw new ConflictError('ไม่สามารถลบอาคารที่ยังมีชั้นหรือครุภัณฑ์ผูกอยู่ได้ กรุณาย้ายข้อมูลก่อน');
    }

    await this.repo.deleteBuilding(id);
    await auditLogService.record(
      { action: 'DELETE', module: 'asset', entityType: 'Building', entityId: id, description: `ลบอาคาร ${existing.name}` },
      ctx,
    );
  }

  // --- Floors ---
  async listFloors(buildingId?: string) {
    return this.repo.findFloors(buildingId);
  }

  async createFloor(dto: CreateFloorDto, ctx: IRequestContext) {
    const building = await this.repo.findBuildingById(dto.buildingId);
    if (!building) throw new NotFoundError('ไม่พบอาคารที่ระบุ');

    const floor = await this.repo.createFloor({ id: randomUUID(), ...dto });
    await auditLogService.record(
      { action: 'CREATE', module: 'asset', entityType: 'Floor', entityId: floor.id, description: `สร้างชั้น ${floor.name}` },
      ctx,
    );
    return floor;
  }

  async updateFloor(id: string, dto: UpdateFloorDto, ctx: IRequestContext) {
    const existing = await this.repo.findFloorById(id);
    if (!existing) throw new NotFoundError('ไม่พบชั้น');

    const floor = await this.repo.updateFloor(id, dto);
    await auditLogService.record(
      { action: 'UPDATE', module: 'asset', entityType: 'Floor', entityId: id, description: `แก้ไขชั้น ${floor.name}` },
      ctx,
    );
    return floor;
  }

  async removeFloor(id: string, ctx: IRequestContext) {
    const existing = await this.repo.findFloorById(id);
    if (!existing) throw new NotFoundError('ไม่พบชั้น');

    const [roomCount, assetCount] = await Promise.all([
      this.repo.countRoomsByFloor(id),
      this.repo.countAssetsByFloor(id),
    ]);
    if (roomCount > 0 || assetCount > 0) {
      throw new ConflictError('ไม่สามารถลบชั้นที่ยังมีห้องหรือครุภัณฑ์ผูกอยู่ได้ กรุณาย้ายข้อมูลก่อน');
    }

    await this.repo.deleteFloor(id);
    await auditLogService.record(
      { action: 'DELETE', module: 'asset', entityType: 'Floor', entityId: id, description: `ลบชั้น ${existing.name}` },
      ctx,
    );
  }

  // --- Rooms ---
  async listRooms(floorId?: string) {
    return this.repo.findRooms(floorId);
  }

  async createRoom(dto: CreateRoomDto, ctx: IRequestContext) {
    const floor = await this.repo.findFloorById(dto.floorId);
    if (!floor) throw new NotFoundError('ไม่พบชั้นที่ระบุ');

    const room = await this.repo.createRoom({ id: randomUUID(), ...dto });
    await auditLogService.record(
      { action: 'CREATE', module: 'asset', entityType: 'Room', entityId: room.id, description: `สร้างห้อง ${room.name}` },
      ctx,
    );
    return room;
  }

  async updateRoom(id: string, dto: UpdateRoomDto, ctx: IRequestContext) {
    const existing = await this.repo.findRoomById(id);
    if (!existing) throw new NotFoundError('ไม่พบห้อง');

    const room = await this.repo.updateRoom(id, dto);
    await auditLogService.record(
      { action: 'UPDATE', module: 'asset', entityType: 'Room', entityId: id, description: `แก้ไขห้อง ${room.name}` },
      ctx,
    );
    return room;
  }

  async removeRoom(id: string, ctx: IRequestContext) {
    const existing = await this.repo.findRoomById(id);
    if (!existing) throw new NotFoundError('ไม่พบห้อง');

    const assetCount = await this.repo.countAssetsByRoom(id);
    if (assetCount > 0) {
      throw new ConflictError('ไม่สามารถลบห้องที่ยังมีครุภัณฑ์ผูกอยู่ได้ กรุณาย้ายข้อมูลก่อน');
    }

    await this.repo.deleteRoom(id);
    await auditLogService.record(
      { action: 'DELETE', module: 'asset', entityType: 'Room', entityId: id, description: `ลบห้อง ${existing.name}` },
      ctx,
    );
  }
}
