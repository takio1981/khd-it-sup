export interface IUserListItem {
  id: string;
  username: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  gender: 'MALE' | 'FEMALE' | null;
  isActive: boolean;
  isUnitHead: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  role: { id: string; code: string; nameTh: string };
  department: { id: string; nameTh: string } | null;
  position: { id: string; nameTh: string } | null;
}

export interface ICreateUserPayload {
  username: string;
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  gender?: 'MALE' | 'FEMALE';
  roleId: string;
  departmentId?: string;
  positionId?: string;
  isUnitHead?: boolean;
}

export interface IUserStats {
  total: number;
  active: number;
  inactive: number;
  mustChangePassword: number;
  byRole: { roleId: string; roleNameTh: string; count: number }[];
  byDepartment: { departmentId: string | null; departmentNameTh: string; count: number }[];
  byPosition: { positionId: string | null; positionNameTh: string; count: number }[];
}

export interface IDepartment {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string | null;
  parentId: string | null;
  isActive: boolean;
}

export interface IPosition {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string | null;
  isActive: boolean;
}

export interface IDivision {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string | null;
  isActive: boolean;
  departmentId: string;
  department: { id: string; nameTh: string } | null;
}
