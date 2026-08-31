const BASE_URL = 'https://apikorat.moph.go.th/assettracker/api/v1/Public/equipments';

export interface IMophEquipmentRecord {
  id: number;
  equip_no_full: string;
  equip_no: string;
  detail: string | null;
  brand: string | null;
  model: string | null;
  serial_no: string | null;
  price: string | null;
  unit_type: string | null;
  location: string | null;
  location_name: string | null;
  owner: string | null;
  status: string | null;
  datetime_in: string | null;
  budget_year: string | null;
  equip_group: number | null;
  equip_group_name: string | null;
  equip_class: string | null;
  equip_type: string | null;
  equip_type_name: string | null;
  equip_sub_type: string | null;
  equip_sub_name: string | null;
}

export interface IMophEquipmentPage {
  status: string;
  data: IMophEquipmentRecord[];
  meta: {
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
  };
}

/** ดึงข้อมูลครุภัณฑ์ 1 หน้า จาก MOPH AssetTracker (public API, ไม่ต้อง auth) — ไม่ต้องใช้ library เพิ่ม ใช้ fetch ที่มีอยู่แล้วใน Node 20 */
export async function fetchEquipmentPage(page: number): Promise<IMophEquipmentPage> {
  const res = await fetch(`${BASE_URL}?page=${page}`);
  if (!res.ok) {
    throw new Error(`MOPH AssetTracker API error (HTTP ${res.status}, page ${page})`);
  }
  return (await res.json()) as IMophEquipmentPage;
}
