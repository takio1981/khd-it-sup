/**
 * Prisma seed script — เทียบเท่า database/seed.sql แต่ idempotent (ใช้ upsert) เหมาะสำหรับ dev loop
 * รัน: npm run prisma:seed
 *
 * Production/fresh install ควรใช้ database/schema.sql + database/seed.sql โดยตรงผ่าน MariaDB
 * docker-entrypoint-initdb.d เพื่อให้ได้ trigger/fulltext index ที่ Prisma ไม่ได้ manage (ดู schema.prisma header)
 */
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient, type AssetStatus } from '@prisma/client';

const prisma = new PrismaClient();

const ROLES = [
  { code: 'SUPER_ADMIN', nameTh: 'ผู้ดูแลระบบสูงสุด', nameEn: 'Super Admin', description: 'สิทธิ์ทุกอย่างในระบบ', isSystem: true },
  { code: 'ADMIN', nameTh: 'ผู้ดูแลระบบ', nameEn: 'Admin', description: 'จัดการครุภัณฑ์/งานซ่อม/ผู้ใช้/แดชบอร์ด/รายงาน', isSystem: true },
  { code: 'IT_OFFICER', nameTh: 'เจ้าหน้าที่ไอที', nameEn: 'IT Officer', description: 'รับงาน มอบหมายงาน ปรับสถานะ พิมพ์เอกสาร', isSystem: true },
  { code: 'TECHNICIAN', nameTh: 'ช่างเทคนิค', nameEn: 'Technician', description: 'ปรับสถานะงานซ่อม อัปโหลดรูป บันทึกการซ่อม', isSystem: true },
  { code: 'USER', nameTh: 'ผู้ใช้งานทั่วไป', nameEn: 'User', description: 'แจ้งซ่อม ติดตามงาน พิมพ์ QR ดูประวัติ', isSystem: true },
] as const;

const PERMISSIONS: { code: string; module: string; description: string }[] = [
  { code: 'dashboard:view', module: 'dashboard', description: 'ดู Dashboard' },
  { code: 'asset:create', module: 'asset', description: 'สร้างครุภัณฑ์' },
  { code: 'asset:read', module: 'asset', description: 'ดูรายการ/รายละเอียดครุภัณฑ์' },
  { code: 'asset:update', module: 'asset', description: 'แก้ไขครุภัณฑ์' },
  { code: 'asset:delete', module: 'asset', description: 'ลบครุภัณฑ์' },
  { code: 'asset:view_history', module: 'asset', description: 'ดูประวัติครุภัณฑ์' },
  { code: 'qrcode:generate', module: 'qrcode', description: 'สร้าง/พิมพ์ QR Code' },
  { code: 'qrcode:print', module: 'qrcode', description: 'พิมพ์ QR Code' },
  { code: 'ticket:create', module: 'ticket', description: 'แจ้งซ่อม' },
  { code: 'ticket:read', module: 'ticket', description: 'ดูรายการ/รายละเอียดใบแจ้งซ่อม' },
  { code: 'ticket:track', module: 'ticket', description: 'ติดตามสถานะงานของตนเอง' },
  { code: 'ticket:receive', module: 'ticket', description: 'รับเรื่องแจ้งซ่อม' },
  { code: 'ticket:assign', module: 'ticket', description: 'มอบหมายช่างผู้รับผิดชอบ' },
  { code: 'ticket:update_status', module: 'ticket', description: 'ปรับสถานะงานซ่อม' },
  { code: 'ticket:upload_attachment', module: 'ticket', description: 'อัปโหลดรูป/ไฟล์แนบ' },
  { code: 'ticket:cancel', module: 'ticket', description: 'ยกเลิกใบแจ้งซ่อม' },
  { code: 'ticket:close', module: 'ticket', description: 'ปิดงานซ่อม' },
  { code: 'ticket:accept', module: 'ticket', description: 'เซ็นรับงานคืน (ผู้แจ้งซ่อมยืนยันรับมอบอุปกรณ์ของตนเองเท่านั้น)' },
  { code: 'ticket:approve_unit_head', module: 'ticket', description: 'ลงนามอนุมัติ (หัวหน้างาน/กลุ่มงาน) เฉพาะใบแจ้งซ่อมของหน่วยงานตนเอง' },
  { code: 'user:create', module: 'user', description: 'สร้างผู้ใช้' },
  { code: 'user:read', module: 'user', description: 'ดูรายชื่อผู้ใช้' },
  { code: 'user:update', module: 'user', description: 'แก้ไขผู้ใช้' },
  { code: 'user:delete', module: 'user', description: 'ลบผู้ใช้' },
  { code: 'user:reset_password', module: 'user', description: 'รีเซ็ตรหัสผ่านผู้ใช้' },
  { code: 'department:manage', module: 'department', description: 'จัดการหน่วยงาน/ตำแหน่ง' },
  { code: 'report:view', module: 'report', description: 'ดูรายงาน' },
  { code: 'report:export', module: 'report', description: 'ส่งออกรายงาน (Excel/PDF/CSV)' },
  { code: 'settings:manage', module: 'settings', description: 'จัดการตั้งค่าระบบ' },
  { code: 'audit:view', module: 'audit', description: 'ดู Audit Log' },
  { code: 'workflow:configure', module: 'workflow', description: 'ตั้งค่า Workflow Engine' },
  { code: 'document:print', module: 'document', description: 'พิมพ์เอกสารราชการ' },
  { code: 'document:generate', module: 'document', description: 'สร้างเอกสารราชการ' },
];

const ROLE_PERMISSION_MAP: Record<string, string[] | '*'> = {
  SUPER_ADMIN: '*',
  ADMIN: [
    'dashboard:view',
    'asset:create', 'asset:read', 'asset:update', 'asset:delete', 'asset:view_history',
    'qrcode:generate', 'qrcode:print',
    'ticket:create', 'ticket:read', 'ticket:receive', 'ticket:assign', 'ticket:update_status',
    'ticket:upload_attachment', 'ticket:cancel', 'ticket:close',
    'user:create', 'user:read', 'user:update', 'user:delete', 'user:reset_password',
    'department:manage', 'report:view', 'report:export',
    'document:print', 'document:generate',
  ],
  IT_OFFICER: [
    'dashboard:view', 'asset:read', 'qrcode:generate',
    'ticket:read', 'ticket:receive', 'ticket:assign', 'ticket:update_status', 'ticket:upload_attachment', 'ticket:close',
    'document:print', 'document:generate',
  ],
  TECHNICIAN: ['asset:read', 'ticket:read', 'ticket:update_status', 'ticket:upload_attachment', 'ticket:close'],
  USER: [
    'asset:read', 'asset:view_history', 'qrcode:print', 'ticket:create', 'ticket:read', 'ticket:track',
    'ticket:accept', 'ticket:approve_unit_head',
  ],
};

const ASSET_CATEGORIES: { code: string; nameTh: string; nameEn: string; icon: string; requiresSerial: boolean }[] = [
  { code: 'COMPUTER', nameTh: 'คอมพิวเตอร์ตั้งโต๊ะ', nameEn: 'Computer', icon: 'ComputerDesktopIcon', requiresSerial: true },
  { code: 'NOTEBOOK', nameTh: 'คอมพิวเตอร์โน้ตบุ๊ก', nameEn: 'Notebook', icon: 'DevicePhoneMobileIcon', requiresSerial: true },
  { code: 'PRINTER', nameTh: 'เครื่องพิมพ์', nameEn: 'Printer', icon: 'PrinterIcon', requiresSerial: true },
  { code: 'SCANNER', nameTh: 'เครื่องสแกน', nameEn: 'Scanner', icon: 'ScannerIcon', requiresSerial: true },
  { code: 'UPS', nameTh: 'เครื่องสำรองไฟ', nameEn: 'UPS', icon: 'BoltIcon', requiresSerial: true },
  { code: 'SWITCH', nameTh: 'สวิตช์เครือข่าย', nameEn: 'Switch', icon: 'ShareIcon', requiresSerial: true },
  { code: 'ROUTER', nameTh: 'เราเตอร์', nameEn: 'Router', icon: 'WifiIcon', requiresSerial: true },
  { code: 'FIREWALL', nameTh: 'ไฟร์วอลล์', nameEn: 'Firewall', icon: 'ShieldCheckIcon', requiresSerial: true },
  { code: 'SERVER', nameTh: 'เครื่องแม่ข่าย', nameEn: 'Server', icon: 'ServerIcon', requiresSerial: true },
  { code: 'MONITOR', nameTh: 'จอภาพ', nameEn: 'Monitor', icon: 'ComputerDesktopIcon', requiresSerial: true },
  { code: 'PROJECTOR', nameTh: 'เครื่องฉายภาพ', nameEn: 'Projector', icon: 'VideoCameraIcon', requiresSerial: true },
  { code: 'AC', nameTh: 'เครื่องปรับอากาศ', nameEn: 'Air Conditioner', icon: 'CloudIcon', requiresSerial: false },
  { code: 'MEDICAL', nameTh: 'ครุภัณฑ์การแพทย์', nameEn: 'Medical Equipment', icon: 'HeartIcon', requiresSerial: false },
  { code: 'OTHER', nameTh: 'ครุภัณฑ์อื่นๆ', nameEn: 'Other Equipment', icon: 'CubeIcon', requiresSerial: false },
];

const WORKFLOW_STEPS = [
  { code: 'DRAFT', th: 'ร่าง', en: 'Draft', order: 0, role: 'USER', sla: null, color: '#9CA3AF', terminal: false },
  { code: 'SUBMITTED', th: 'แจ้งซ่อมแล้ว', en: 'Submitted', order: 1, role: 'USER', sla: 2, color: '#3B82F6', terminal: false },
  { code: 'RECEIVED', th: 'รับเรื่องแล้ว', en: 'Received', order: 2, role: 'IT_OFFICER', sla: 4, color: '#6366F1', terminal: false },
  { code: 'IT_REVIEW', th: 'ตรวจสอบเบื้องต้น', en: 'IT Review', order: 3, role: 'IT_OFFICER', sla: 8, color: '#6366F1', terminal: false },
  { code: 'DIAGNOSIS', th: 'วิเคราะห์ปัญหา', en: 'Diagnosis', order: 4, role: 'TECHNICIAN', sla: 24, color: '#8B5CF6', terminal: false },
  { code: 'WAITING_PARTS', th: 'รออะไหล่', en: 'Waiting Spare Parts', order: 5, role: 'TECHNICIAN', sla: null, color: '#F59E0B', terminal: false },
  { code: 'REPAIRING', th: 'กำลังซ่อม', en: 'Repair In Progress', order: 6, role: 'TECHNICIAN', sla: 48, color: '#06B6D4', terminal: false },
  { code: 'TESTING', th: 'ทดสอบระบบ', en: 'Testing', order: 7, role: 'TECHNICIAN', sla: 8, color: '#06B6D4', terminal: false },
  { code: 'COMPLETED', th: 'ซ่อมเสร็จสิ้น', en: 'Completed', order: 8, role: 'TECHNICIAN', sla: 4, color: '#22C55E', terminal: false },
  { code: 'RETURNED', th: 'คืนอุปกรณ์แล้ว', en: 'Returned to User', order: 9, role: 'IT_OFFICER', sla: 24, color: '#14B8A6', terminal: false },
  { code: 'USER_ACCEPTANCE', th: 'ผู้แจ้งรับมอบ', en: 'User Acceptance', order: 10, role: 'USER', sla: 48, color: '#14B8A6', terminal: false, approval: true },
  { code: 'CLOSED', th: 'ปิดงาน', en: 'Closed', order: 11, role: 'IT_OFFICER', sla: null, color: '#166534', terminal: true },
  { code: 'CANCELLED', th: 'ยกเลิก', en: 'Cancelled', order: 99, role: null, sla: null, color: '#EF4444', terminal: true },
] as const;

const WORKFLOW_TRANSITIONS: [string | null, string, string?][] = [
  [null, 'SUBMITTED', 'ผู้ใช้แจ้งซ่อม'],
  ['SUBMITTED', 'RECEIVED', 'ไอทีรับเรื่อง'],
  ['RECEIVED', 'IT_REVIEW', 'ตรวจสอบเบื้องต้น'],
  ['IT_REVIEW', 'DIAGNOSIS', 'มอบหมายช่างวิเคราะห์'],
  ['DIAGNOSIS', 'WAITING_PARTS', 'ต้องรออะไหล่'],
  ['DIAGNOSIS', 'REPAIRING', 'ซ่อมได้ทันที'],
  ['WAITING_PARTS', 'REPAIRING', 'อะไหล่พร้อม เริ่มซ่อม'],
  ['REPAIRING', 'TESTING', 'ซ่อมเสร็จ รอทดสอบ'],
  ['TESTING', 'COMPLETED', 'ทดสอบผ่าน'],
  ['COMPLETED', 'RETURNED', 'คืนอุปกรณ์ให้ผู้ใช้'],
  ['RETURNED', 'USER_ACCEPTANCE', 'ผู้ใช้ตรวจรับ'],
  ['USER_ACCEPTANCE', 'CLOSED', 'ปิดงาน'],
  ['SUBMITTED', 'CANCELLED', 'ยกเลิกโดยผู้แจ้ง/ผู้ดูแล'],
  ['RECEIVED', 'CANCELLED', 'ยกเลิกโดยผู้แจ้ง/ผู้ดูแล'],
  ['IT_REVIEW', 'CANCELLED', 'ยกเลิกโดยผู้แจ้ง/ผู้ดูแล'],
];

async function main(): Promise<void> {
  console.log('🌱 Seeding database...');

  // 1. Roles
  const roleIdByCode = new Map<string, string>();
  for (const role of ROLES) {
    const saved = await prisma.role.upsert({
      where: { code: role.code },
      update: { nameTh: role.nameTh, nameEn: role.nameEn, description: role.description },
      create: { id: randomUUID(), ...role },
    });
    roleIdByCode.set(role.code, saved.id);
  }

  // 2. Permissions
  const permissionIdByCode = new Map<string, string>();
  for (const perm of PERMISSIONS) {
    const saved = await prisma.permission.upsert({
      where: { code: perm.code },
      update: { module: perm.module, description: perm.description },
      create: { id: randomUUID(), ...perm },
    });
    permissionIdByCode.set(perm.code, saved.id);
  }

  // 3. Role-Permissions
  for (const [roleCode, perms] of Object.entries(ROLE_PERMISSION_MAP)) {
    const roleId = roleIdByCode.get(roleCode)!;
    const codes = perms === '*' ? PERMISSIONS.map((p) => p.code) : perms;
    for (const code of codes) {
      const permissionId = permissionIdByCode.get(code)!;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }

  // 4. Departments
  const hq = await prisma.department.upsert({
    where: { code: 'HQ' },
    update: {},
    create: { id: randomUUID(), code: 'HQ', nameTh: 'สำนักงานสาธารณสุขจังหวัดนครราชสีมา', nameEn: 'Nakhon Ratchasima Provincial Public Health Office' },
  });
  const itDept = await prisma.department.upsert({
    where: { code: 'IT' },
    update: {},
    create: { id: randomUUID(), code: 'IT', nameTh: 'กลุ่มงานเทคโนโลยีสารสนเทศ', nameEn: 'IT Department', parentId: hq.id },
  });
  await prisma.department.upsert({
    where: { code: 'ADMIN' },
    update: {},
    create: { id: randomUUID(), code: 'ADMIN', nameTh: 'ฝ่ายบริหารทั่วไป', nameEn: 'General Administration', parentId: hq.id },
  });
  await prisma.department.upsert({
    where: { code: 'FINANCE' },
    update: {},
    create: { id: randomUUID(), code: 'FINANCE', nameTh: 'กลุ่มงานการเงินและบัญชี', nameEn: 'Finance & Accounting', parentId: hq.id },
  });

  // 5. Positions
  for (const pos of [
    { code: 'DIRECTOR', nameTh: 'ผู้อำนวยการ', nameEn: 'Director' },
    { code: 'IT_ANALYST', nameTh: 'นักวิชาการคอมพิวเตอร์', nameEn: 'IT Analyst' },
    { code: 'IT_TECH', nameTh: 'เจ้าพนักงานเครื่องคอมพิวเตอร์', nameEn: 'IT Technician Officer' },
    { code: 'TECHNICIAN', nameTh: 'ช่างเทคนิค', nameEn: 'Technician' },
    { code: 'STAFF', nameTh: 'เจ้าหน้าที่', nameEn: 'Staff' },
  ]) {
    await prisma.position.upsert({ where: { code: pos.code }, update: {}, create: { id: randomUUID(), ...pos } });
  }

  // 6. Asset Categories
  for (const cat of ASSET_CATEGORIES) {
    await prisma.assetCategory.upsert({ where: { code: cat.code }, update: {}, create: { id: randomUUID(), ...cat } });
  }

  // 7. Building / Floor / Room (ตัวอย่าง)
  const building = await prisma.building.upsert({
    where: { code: 'BLD-1' },
    update: {},
    create: { id: randomUUID(), code: 'BLD-1', name: 'อาคารสำนักงานสาธารณสุขจังหวัด' },
  });
  await prisma.floor.upsert({
    where: { id: '00000000-0000-0000-0000-000000000f01' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000f01', buildingId: building.id, code: 'F1', name: 'ชั้น 1' },
  });

  // 8. Admin user
  const passwordHash = await bcrypt.hash('Admin@12345', 12);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      id: randomUUID(),
      username: 'admin',
      email: 'admin@nma-pho.local',
      passwordHash,
      fullName: 'ผู้ดูแลระบบ',
      phone: '044-000000',
      roleId: roleIdByCode.get('SUPER_ADMIN')!,
      departmentId: itDept.id,
      isActive: true,
      mustChangePassword: true,
    },
  });

  // 9. Workflow: REPAIR_INTERNAL
  const template = await prisma.workflowTemplate.upsert({
    where: { code_version: { code: 'REPAIR_INTERNAL', version: 1 } },
    update: {},
    create: {
      id: randomUUID(),
      code: 'REPAIR_INTERNAL',
      name: 'ขั้นตอนการซ่อมภายใน (Internal Repair)',
      appliesTo: 'REPAIR_INTERNAL',
      version: 1,
    },
  });

  const stepIdByCode = new Map<string, string>();
  for (const step of WORKFLOW_STEPS) {
    const saved = await prisma.workflowStep.upsert({
      where: { templateId_stepCode: { templateId: template.id, stepCode: step.code } },
      update: {},
      create: {
        id: randomUUID(),
        templateId: template.id,
        stepCode: step.code,
        stepNameTh: step.th,
        stepNameEn: step.en,
        stepOrder: step.order,
        responsibleRoleId: step.role ? roleIdByCode.get(step.role) : null,
        slaHours: step.sla,
        colorCode: step.color,
        isTerminal: step.terminal,
        requiresApproval: 'approval' in step ? Boolean(step.approval) : false,
      },
    });
    stepIdByCode.set(step.code, saved.id);
  }

  const existingTransitions = await prisma.workflowTransition.findMany({ where: { templateId: template.id } });
  if (existingTransitions.length === 0) {
    for (const [from, to, label] of WORKFLOW_TRANSITIONS) {
      await prisma.workflowTransition.create({
        data: {
          id: randomUUID(),
          templateId: template.id,
          fromStepId: from ? stepIdByCode.get(from) : null,
          toStepId: stepIdByCode.get(to)!,
          label,
        },
      });
    }
  }

  // 10. System settings
  const settings: { key: string; value: string; category: string; secret?: boolean }[] = [
    { key: 'org.name_th', value: 'สำนักงานสาธารณสุขจังหวัดนครราชสีมา', category: 'ORGANIZATION' },
    { key: 'org.name_en', value: 'Nakhon Ratchasima Provincial Public Health Office', category: 'ORGANIZATION' },
    { key: 'theme.primary', value: '#006C45', category: 'THEME' },
    { key: 'theme.secondary', value: '#00A86B', category: 'THEME' },
    { key: 'theme.background', value: '#F7FAF8', category: 'THEME' },
  ];
  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { settingKey: s.key },
      update: {},
      create: { id: randomUUID(), settingKey: s.key, settingValue: s.value, category: s.category, isSecret: s.secret ?? false },
    });
  }

  // 11. Running number sequences
  for (const seq of [
    { docType: 'TICKET', prefix: '', yearFormat: 'CE', resetYearly: true },
    { docType: 'ASSET', prefix: 'IT-', yearFormat: 'CE', resetYearly: false },
  ]) {
    await prisma.runningNumberSequence.upsert({
      where: { docType: seq.docType },
      update: {},
      create: { id: randomUUID(), currentNumber: 0, ...seq },
    });
  }

  console.log('✅ Seeding complete. Login: admin / Admin@12345 (ต้องเปลี่ยนรหัสผ่านทันทีหลัง deploy จริง)');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());

// เก็บ import type ไว้ใช้ตรวจสอบ enum ให้ตรงกับ Prisma schema ตอน compile (กัน type drift ถ้ามีการเพิ่ม AssetStatus ใหม่)
const _assertAssetStatusType: AssetStatus = 'ACTIVE';
void _assertAssetStatusType;
