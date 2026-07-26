import type { Prisma } from '@prisma/client';
import { prisma } from '@infrastructure/database/prisma';

export class LocationRepository {
  // --- Buildings ---
  async findAllBuildings() {
    return prisma.building.findMany({ orderBy: { name: 'asc' } });
  }

  async findBuildingById(id: string) {
    return prisma.building.findUnique({ where: { id } });
  }

  async findBuildingByCode(code: string) {
    return prisma.building.findUnique({ where: { code } });
  }

  async createBuilding(data: Prisma.BuildingUncheckedCreateInput) {
    return prisma.building.create({ data });
  }

  async updateBuilding(id: string, data: Prisma.BuildingUncheckedUpdateInput) {
    return prisma.building.update({ where: { id }, data });
  }

  async deleteBuilding(id: string) {
    return prisma.building.delete({ where: { id } });
  }

  async countFloorsByBuilding(buildingId: string): Promise<number> {
    return prisma.floor.count({ where: { buildingId } });
  }

  async countAssetsByBuilding(buildingId: string): Promise<number> {
    return prisma.asset.count({ where: { buildingId, deletedAt: null } });
  }

  // --- Floors ---
  async findFloors(buildingId?: string) {
    return prisma.floor.findMany({
      where: buildingId ? { buildingId } : undefined,
      include: { building: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findFloorById(id: string) {
    return prisma.floor.findUnique({ where: { id } });
  }

  async createFloor(data: Prisma.FloorUncheckedCreateInput) {
    return prisma.floor.create({ data, include: { building: { select: { id: true, name: true } } } });
  }

  async updateFloor(id: string, data: Prisma.FloorUncheckedUpdateInput) {
    return prisma.floor.update({ where: { id }, data, include: { building: { select: { id: true, name: true } } } });
  }

  async deleteFloor(id: string) {
    return prisma.floor.delete({ where: { id } });
  }

  async countRoomsByFloor(floorId: string): Promise<number> {
    return prisma.room.count({ where: { floorId } });
  }

  async countAssetsByFloor(floorId: string): Promise<number> {
    return prisma.asset.count({ where: { floorId, deletedAt: null } });
  }

  // --- Rooms ---
  async findRooms(floorId?: string) {
    return prisma.room.findMany({
      where: floorId ? { floorId } : undefined,
      include: {
        floor: { select: { id: true, name: true, building: { select: { id: true, name: true } } } },
        department: { select: { id: true, nameTh: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findRoomById(id: string) {
    return prisma.room.findUnique({ where: { id } });
  }

  async createRoom(data: Prisma.RoomUncheckedCreateInput) {
    return prisma.room.create({
      data,
      include: { floor: { select: { id: true, name: true } }, department: { select: { id: true, nameTh: true } } },
    });
  }

  async updateRoom(id: string, data: Prisma.RoomUncheckedUpdateInput) {
    return prisma.room.update({
      where: { id },
      data,
      include: { floor: { select: { id: true, name: true } }, department: { select: { id: true, nameTh: true } } },
    });
  }

  async deleteRoom(id: string) {
    return prisma.room.delete({ where: { id } });
  }

  async countAssetsByRoom(roomId: string): Promise<number> {
    return prisma.asset.count({ where: { roomId, deletedAt: null } });
  }
}
