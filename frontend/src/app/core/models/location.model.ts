export interface IBuilding {
  id: string;
  code: string;
  name: string;
}

export interface IFloor {
  id: string;
  buildingId: string;
  code: string;
  name: string;
  building?: { id: string; name: string };
}

export interface IRoom {
  id: string;
  floorId: string;
  departmentId: string | null;
  code: string;
  name: string;
  floor?: { id: string; name: string };
  department?: { id: string; nameTh: string } | null;
}
