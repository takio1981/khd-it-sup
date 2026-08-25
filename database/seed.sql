-- =====================================================================================
-- KHD-IT-SUP :: Seed Data (ข้อมูลตั้งต้น)
-- รันหลังจาก schema.sql เสมอ: mysql -u root -p khd_it_sup < schema.sql && mysql -u root -p khd_it_sup < seed.sql
-- =====================================================================================

USE `khd_it_sup`;
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================================================
-- 1. ROLES
-- =====================================================================================
SET @role_super_admin = UUID();
SET @role_admin       = UUID();
SET @role_it_officer  = UUID();
SET @role_technician  = UUID();
SET @role_user        = UUID();

INSERT INTO `roles` (`id`, `code`, `name_th`, `name_en`, `description`, `is_system`) VALUES
(@role_super_admin, 'SUPER_ADMIN', 'ผู้ดูแลระบบสูงสุด', 'Super Admin', 'สิทธิ์ทุกอย่างในระบบ', 1),
(@role_admin,       'ADMIN',       'ผู้ดูแลระบบ',       'Admin',       'จัดการครุภัณฑ์/งานซ่อม/ผู้ใช้/แดชบอร์ด/รายงาน', 1),
(@role_it_officer,  'IT_OFFICER',  'เจ้าหน้าที่ไอที',    'IT Officer',  'รับงาน มอบหมายงาน ปรับสถานะ พิมพ์เอกสาร', 1),
(@role_technician,  'TECHNICIAN',  'ช่างเทคนิค',        'Technician',  'ปรับสถานะงานซ่อม อัปโหลดรูป บันทึกการซ่อม', 1),
(@role_user,        'USER',        'ผู้ใช้งานทั่วไป',    'User',        'แจ้งซ่อม ติดตามงาน พิมพ์ QR ดูประวัติ', 1);

-- =====================================================================================
-- 2. PERMISSIONS
-- =====================================================================================
INSERT INTO `permissions` (`id`, `code`, `module`, `description`) VALUES
(UUID(), 'dashboard:view',        'dashboard', 'ดู Dashboard'),
(UUID(), 'asset:create',          'asset',     'สร้างครุภัณฑ์'),
(UUID(), 'asset:read',            'asset',     'ดูรายการ/รายละเอียดครุภัณฑ์'),
(UUID(), 'asset:update',          'asset',     'แก้ไขครุภัณฑ์'),
(UUID(), 'asset:delete',          'asset',     'ลบครุภัณฑ์'),
(UUID(), 'asset:view_history',    'asset',     'ดูประวัติครุภัณฑ์'),
(UUID(), 'asset:loan',            'asset',     'บันทึกยืม-คืนอุปกรณ์ (ดู/แก้ไข/ลบได้ทุกรายการ)'),
(UUID(), 'asset:loan_self',       'asset',     'ยืม-คืนอุปกรณ์ของตนเองผ่านสแกน QR (self-service ไม่เห็น/แก้รายการของผู้อื่น)'),
(UUID(), 'qrcode:generate',       'qrcode',    'สร้าง/พิมพ์ QR Code'),
(UUID(), 'qrcode:print',          'qrcode',    'พิมพ์ QR Code'),
(UUID(), 'ticket:create',         'ticket',    'แจ้งซ่อม'),
(UUID(), 'ticket:read',           'ticket',    'ดูรายการ/รายละเอียดใบแจ้งซ่อม'),
(UUID(), 'ticket:track',          'ticket',    'ติดตามสถานะงานของตนเอง'),
(UUID(), 'ticket:receive',        'ticket',    'รับเรื่องแจ้งซ่อม'),
(UUID(), 'ticket:assign',         'ticket',    'มอบหมายช่างผู้รับผิดชอบ'),
(UUID(), 'ticket:update_status',  'ticket',    'ปรับสถานะงานซ่อม'),
(UUID(), 'ticket:upload_attachment', 'ticket', 'อัปโหลดรูป/ไฟล์แนบ'),
(UUID(), 'ticket:cancel',         'ticket',    'ยกเลิกใบแจ้งซ่อม'),
(UUID(), 'ticket:close',          'ticket',    'ปิดงานซ่อม'),
(UUID(), 'ticket:accept',         'ticket',    'เซ็นรับงานคืน (ผู้แจ้งซ่อมยืนยันรับมอบอุปกรณ์ของตนเองเท่านั้น)'),
(UUID(), 'ticket:approve_unit_head', 'ticket', 'ลงนามอนุมัติ (หัวหน้างาน/กลุ่มงาน) เฉพาะใบแจ้งซ่อมของหน่วยงานตนเอง — ต้องตั้งค่า is_unit_head ไว้ด้วย'),
(UUID(), 'ticket:approve',        'ticket',    'ลงนามอนุมัติ (หัวหน้างาน/หัวหน้ากลุ่มงาน)'),
(UUID(), 'user:create',           'user',      'สร้างผู้ใช้'),
(UUID(), 'user:read',             'user',      'ดูรายชื่อผู้ใช้'),
(UUID(), 'user:update',           'user',      'แก้ไขผู้ใช้'),
(UUID(), 'user:delete',           'user',      'ลบผู้ใช้'),
(UUID(), 'user:reset_password',   'user',      'รีเซ็ตรหัสผ่านผู้ใช้'),
(UUID(), 'department:manage',     'department','จัดการหน่วยงาน/ตำแหน่ง'),
(UUID(), 'report:view',           'report',    'ดูรายงาน'),
(UUID(), 'report:export',         'report',    'ส่งออกรายงาน (Excel/PDF/CSV)'),
(UUID(), 'settings:manage',       'settings',  'จัดการตั้งค่าระบบ'),
(UUID(), 'audit:view',            'audit',     'ดู Audit Log'),
(UUID(), 'workflow:configure',    'workflow',  'ตั้งค่า Workflow Engine'),
(UUID(), 'document:print',        'document',  'พิมพ์เอกสารราชการ'),
(UUID(), 'document:generate',     'document',  'สร้างเอกสารราชการ'),
(UUID(), 'spare_part:view',       'spare_part','ดูรายการ/สต็อกอะไหล่'),
(UUID(), 'spare_part:manage',     'spare_part','จัดการข้อมูลอะไหล่ (เพิ่ม/แก้ไข/ปรับสต็อก)'),
(UUID(), 'spare_part:issue',      'spare_part','เบิก/คืนอะไหล่ผูกกับใบแจ้งซ่อม'),
(UUID(), 'vendor:view',           'vendor',    'ดูรายชื่อผู้ขาย/ผู้รับซ่อมภายนอกและสถานะงานส่งซ่อม'),
(UUID(), 'vendor:manage',         'vendor',    'จัดการผู้ขาย/ผู้รับซ่อมภายนอก และดำเนินการงานส่งซ่อมภายนอก');

-- =====================================================================================
-- 3. ROLE_PERMISSIONS (Permission Matrix)
-- =====================================================================================

-- Super Admin: ALL permissions
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT @role_super_admin, `id` FROM `permissions`;

-- Admin: manage all assets, repair, users, dashboard, reports
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT @role_admin, `id` FROM `permissions`
WHERE `code` IN (
  'dashboard:view',
  'asset:create','asset:read','asset:update','asset:delete','asset:view_history','asset:loan',
  'qrcode:generate','qrcode:print',
  'ticket:create','ticket:read','ticket:receive','ticket:assign','ticket:update_status',
  'ticket:upload_attachment','ticket:cancel','ticket:close','ticket:approve',
  'user:create','user:read','user:update','user:delete','user:reset_password',
  'department:manage','report:view','report:export',
  'document:print','document:generate',
  'spare_part:view','spare_part:manage','spare_part:issue',
  'vendor:view','vendor:manage'
);

-- IT Officer: receive jobs, assign jobs, update status, print documents
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT @role_it_officer, `id` FROM `permissions`
WHERE `code` IN (
  'dashboard:view','asset:read','asset:loan','qrcode:generate',
  'ticket:read','ticket:receive','ticket:assign','ticket:update_status','ticket:upload_attachment','ticket:approve','ticket:close',
  'document:print','document:generate','report:view','report:export',
  'spare_part:view','spare_part:issue',
  'vendor:view','vendor:manage'
);

-- Technician: update repair status, upload images, record repair, close job
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT @role_technician, `id` FROM `permissions`
WHERE `code` IN (
  'asset:read','asset:loan','ticket:read','ticket:update_status','ticket:upload_attachment','ticket:close',
  'spare_part:view','spare_part:issue',
  'vendor:view'
);

-- User: create ticket, track ticket, print QR, view history, self-service borrow/return via QR scan,
-- self-accept-close own ticket, approve-as-unit-head own department's tickets (requires is_unit_head=1)
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT @role_user, `id` FROM `permissions`
WHERE `code` IN (
  'asset:read','asset:view_history','qrcode:print','asset:loan_self',
  'ticket:create','ticket:read','ticket:track','ticket:accept','ticket:approve_unit_head'
);

-- =====================================================================================
-- 4. DEPARTMENTS & POSITIONS
-- =====================================================================================
SET @dept_root = UUID();
SET @dept_it   = UUID();
SET @dept_admin = UUID();
SET @dept_finance = UUID();
SET @dept_disease = UUID();

INSERT INTO `departments` (`id`, `code`, `name_th`, `name_en`, `parent_id`) VALUES
(@dept_root,    'HQ',      'สำนักงานสาธารณสุขจังหวัดนครราชสีมา', 'Nakhon Ratchasima Provincial Public Health Office', NULL),
(@dept_it,      'IT',      'กลุ่มงานเทคโนโลยีสารสนเทศ',          'IT Department', @dept_root),
(@dept_admin,   'ADMIN',   'ฝ่ายบริหารทั่วไป',                    'General Administration', @dept_root),
(@dept_finance, 'FINANCE', 'กลุ่มงานการเงินและบัญชี',             'Finance & Accounting', @dept_root),
(@dept_disease, 'DISEASE', 'กลุ่มงานควบคุมโรค',                   'Disease Control', @dept_root);

INSERT INTO `positions` (`id`, `code`, `name_th`, `name_en`) VALUES
(UUID(), 'DIRECTOR', 'ผู้อำนวยการ', 'Director'),
(UUID(), 'IT_ANALYST', 'นักวิชาการคอมพิวเตอร์', 'IT Analyst'),
(UUID(), 'IT_TECH', 'เจ้าพนักงานเครื่องคอมพิวเตอร์', 'IT Technician Officer'),
(UUID(), 'TECHNICIAN', 'ช่างเทคนิค', 'Technician'),
(UUID(), 'STAFF', 'เจ้าหน้าที่', 'Staff');

-- =====================================================================================
-- 5. ASSET CATEGORIES (14 ประเภทตามสเปก)
-- =====================================================================================
INSERT INTO `asset_categories` (`id`, `code`, `name_th`, `name_en`, `icon`, `requires_serial`) VALUES
(UUID(), 'COMPUTER',  'คอมพิวเตอร์ตั้งโต๊ะ', 'Computer',          'ComputerDesktopIcon', 1),
(UUID(), 'NOTEBOOK',  'คอมพิวเตอร์โน้ตบุ๊ก', 'Notebook',          'DevicePhoneMobileIcon', 1),
(UUID(), 'PRINTER',   'เครื่องพิมพ์',        'Printer',           'PrinterIcon', 1),
(UUID(), 'SCANNER',   'เครื่องสแกน',         'Scanner',           'ScannerIcon', 1),
(UUID(), 'UPS',       'เครื่องสำรองไฟ',      'UPS',               'BoltIcon', 1),
(UUID(), 'SWITCH',    'สวิตช์เครือข่าย',     'Switch',            'ShareIcon', 1),
(UUID(), 'ROUTER',    'เราเตอร์',            'Router',            'WifiIcon', 1),
(UUID(), 'FIREWALL',  'ไฟร์วอลล์',           'Firewall',          'ShieldCheckIcon', 1),
(UUID(), 'SERVER',    'เครื่องแม่ข่าย',       'Server',            'ServerIcon', 1),
(UUID(), 'MONITOR',   'จอภาพ',               'Monitor',           'ComputerDesktopIcon', 1),
(UUID(), 'PROJECTOR', 'เครื่องฉายภาพ',       'Projector',         'VideoCameraIcon', 1),
(UUID(), 'AC',        'เครื่องปรับอากาศ',    'Air Conditioner',   'CloudIcon', 0),
(UUID(), 'MEDICAL',   'ครุภัณฑ์การแพทย์',    'Medical Equipment', 'HeartIcon', 0),
(UUID(), 'OTHER',     'ครุภัณฑ์อื่นๆ',       'Other Equipment',   'CubeIcon', 0);

-- =====================================================================================
-- 6. BUILDING / FLOOR / ROOM (ตัวอย่าง)
-- =====================================================================================
SET @building_1 = UUID();
SET @floor_1_1 = UUID();
SET @floor_1_2 = UUID();

INSERT INTO `buildings` (`id`, `code`, `name`) VALUES
(@building_1, 'BLD-1', 'อาคารสำนักงานสาธารณสุขจังหวัด');

INSERT INTO `floors` (`id`, `building_id`, `code`, `name`) VALUES
(@floor_1_1, @building_1, 'F1', 'ชั้น 1'),
(@floor_1_2, @building_1, 'F2', 'ชั้น 2');

INSERT INTO `rooms` (`id`, `floor_id`, `code`, `name`) VALUES
(UUID(), @floor_1_1, 'R101', 'ห้องธุรการ'),
(UUID(), @floor_1_2, 'R201', 'ห้องกลุ่มงานเทคโนโลยีสารสนเทศ');

-- =====================================================================================
-- 7. ADMIN USER (Super Admin) — Username: admin / Password: Admin@12345 (บังคับเปลี่ยนรหัสผ่านครั้งแรก)
-- =====================================================================================
INSERT INTO `users` (
  `id`, `username`, `email`, `password_hash`, `full_name`, `phone`,
  `role_id`, `department_id`, `is_active`, `must_change_password`
) VALUES (
  UUID(), 'admin', 'admin@nma-pho.local',
  '$2b$12$Y7Kb85xq5Aqtn6zRTdiBLOC4kgXUb7rLuN5c/VmpbqOIVMFflwY4W',
  'ผู้ดูแลระบบ', '044-000000',
  @role_super_admin, @dept_it, 1, 1
);

-- =====================================================================================
-- 8. WORKFLOW: REPAIR_INTERNAL (MVP — Internal Repair Flow เต็มรูปแบบ)
-- =====================================================================================
SET @wf_internal = UUID();

INSERT INTO `workflow_templates` (`id`, `code`, `name`, `applies_to`, `version`, `is_active`) VALUES
(@wf_internal, 'REPAIR_INTERNAL', 'ขั้นตอนการซ่อมภายใน (Internal Repair)', 'REPAIR_INTERNAL', 1, 1);

SET @st_draft     = UUID();
SET @st_submitted = UUID();
SET @st_received  = UUID();
SET @st_review    = UUID();
SET @st_diagnosis = UUID();
SET @st_vendor    = UUID();
SET @st_waitparts = UUID();
SET @st_repairing = UUID();
SET @st_testing   = UUID();
SET @st_completed = UUID();
SET @st_returned  = UUID();
SET @st_accepted  = UUID();
SET @st_closed    = UUID();
SET @st_cancelled = UUID();

INSERT INTO `workflow_steps`
  (`id`, `template_id`, `step_code`, `step_name_th`, `step_name_en`, `step_order`, `responsible_role_id`, `sla_hours`, `requires_approval`, `color_code`, `is_terminal`) VALUES
(@st_draft,     @wf_internal, 'DRAFT',        'ร่าง',                 'Draft',              0, @role_user,       NULL, 0, '#9CA3AF', 0),
(@st_submitted, @wf_internal, 'SUBMITTED',    'แจ้งซ่อมแล้ว',          'Submitted',          1, @role_user,       2,    0, '#3B82F6', 0),
(@st_received,  @wf_internal, 'RECEIVED',     'รับเรื่องแล้ว',         'Received',           2, @role_it_officer, 4,    0, '#6366F1', 0),
(@st_review,    @wf_internal, 'IT_REVIEW',    'ตรวจสอบเบื้องต้น',      'IT Review',          3, @role_it_officer, 8,    0, '#6366F1', 0),
(@st_diagnosis, @wf_internal, 'DIAGNOSIS',    'วิเคราะห์ปัญหา',        'Diagnosis',          4, @role_technician, 24,   0, '#8B5CF6', 0),
(@st_vendor,    @wf_internal, 'VENDOR_REPAIR','ส่งซ่อมภายนอก',         'Vendor Repair',      5, @role_it_officer, 240,  0, '#F97316', 0),
(@st_waitparts, @wf_internal, 'WAITING_PARTS','รออะไหล่',              'Waiting Spare Parts',6, @role_technician, NULL, 0, '#F59E0B', 0),
(@st_repairing, @wf_internal, 'REPAIRING',    'กำลังซ่อม',             'Repair In Progress', 7, @role_technician, 48,   0, '#06B6D4', 0),
(@st_testing,   @wf_internal, 'TESTING',      'ทดสอบระบบ',             'Testing',            8, @role_technician, 8,    0, '#06B6D4', 0),
(@st_completed, @wf_internal, 'COMPLETED',    'ซ่อมเสร็จสิ้น',         'Completed',          9, @role_technician, 4,    0, '#22C55E', 0),
(@st_returned,  @wf_internal, 'RETURNED',     'คืนอุปกรณ์แล้ว',        'Returned to User',   10, @role_it_officer, 24,   0, '#14B8A6', 0),
(@st_accepted,  @wf_internal, 'USER_ACCEPTANCE','ผู้แจ้งรับมอบ',       'User Acceptance',    11, @role_user,      48,   1, '#14B8A6', 0),
(@st_closed,    @wf_internal, 'CLOSED',       'ปิดงาน',                'Closed',             12, @role_it_officer, NULL, 0, '#166534', 1),
(@st_cancelled, @wf_internal, 'CANCELLED',    'ยกเลิก',                'Cancelled',          99, NULL,             NULL, 0, '#EF4444', 1);

INSERT INTO `workflow_transitions` (`id`, `template_id`, `from_step_id`, `to_step_id`, `condition_key`, `label`) VALUES
(UUID(), @wf_internal, NULL,           @st_submitted, NULL, 'ผู้ใช้แจ้งซ่อม'),
(UUID(), @wf_internal, @st_submitted,  @st_received,  NULL, 'ไอทีรับเรื่อง'),
(UUID(), @wf_internal, @st_received,   @st_review,    NULL, 'ตรวจสอบเบื้องต้น'),
(UUID(), @wf_internal, @st_review,     @st_diagnosis, NULL, 'มอบหมายช่างวิเคราะห์'),
(UUID(), @wf_internal, @st_diagnosis,  @st_waitparts, 'NEED_PARTS', 'ต้องรออะไหล่'),
(UUID(), @wf_internal, @st_diagnosis,  @st_repairing, 'READY_REPAIR', 'ซ่อมได้ทันที'),
(UUID(), @wf_internal, @st_diagnosis,  @st_vendor,    'SEND_EXTERNAL', 'ส่งซ่อมภายนอก'),
(UUID(), @wf_internal, @st_vendor,     @st_testing,   NULL, 'รับเครื่องคืนจากร้าน ทดสอบ'),
(UUID(), @wf_internal, @st_vendor,     @st_cancelled, 'CANCEL', 'ยกเลิกโดยผู้แจ้ง/ผู้ดูแล'),
(UUID(), @wf_internal, @st_waitparts,  @st_repairing, NULL, 'อะไหล่พร้อม เริ่มซ่อม'),
(UUID(), @wf_internal, @st_repairing,  @st_testing,   NULL, 'ซ่อมเสร็จ รอทดสอบ'),
(UUID(), @wf_internal, @st_testing,    @st_completed, NULL, 'ทดสอบผ่าน'),
(UUID(), @wf_internal, @st_completed,  @st_returned,  NULL, 'คืนอุปกรณ์ให้ผู้ใช้'),
(UUID(), @wf_internal, @st_returned,   @st_accepted,  NULL, 'ผู้ใช้ตรวจรับ'),
(UUID(), @wf_internal, @st_accepted,   @st_closed,    NULL, 'ปิดงาน'),
(UUID(), @wf_internal, @st_submitted,  @st_cancelled, 'CANCEL', 'ยกเลิกโดยผู้แจ้ง/ผู้ดูแล'),
(UUID(), @wf_internal, @st_received,   @st_cancelled, 'CANCEL', 'ยกเลิกโดยผู้แจ้ง/ผู้ดูแล'),
(UUID(), @wf_internal, @st_review,     @st_cancelled, 'CANCEL', 'ยกเลิกโดยผู้แจ้ง/ผู้ดูแล');

-- =====================================================================================
-- 9. SYSTEM SETTINGS (defaults)
-- =====================================================================================
INSERT INTO `system_settings` (`id`, `setting_key`, `setting_value`, `category`, `is_secret`) VALUES
(UUID(), 'org.name_th',       'สำนักงานสาธารณสุขจังหวัดนครราชสีมา', 'ORGANIZATION', 0),
(UUID(), 'org.name_en',       'Nakhon Ratchasima Provincial Public Health Office', 'ORGANIZATION', 0),
(UUID(), 'org.logo_url',      '/assets/images/logo.png', 'ORGANIZATION', 0),
(UUID(), 'theme.primary',     '#006C45', 'THEME', 0),
(UUID(), 'theme.secondary',   '#00A86B', 'THEME', 0),
(UUID(), 'theme.background',  '#F7FAF8', 'THEME', 0),
(UUID(), 'smtp.host',         'smtp.gmail.com', 'SMTP', 0),
(UUID(), 'smtp.port',         '587', 'SMTP', 0),
(UUID(), 'smtp.secure',       'false', 'SMTP', 0),
(UUID(), 'smtp.user',         '', 'SMTP', 1),
(UUID(), 'smtp.pass',         '', 'SMTP', 1),
(UUID(), 'telegram.bot_token','', 'TELEGRAM', 1),
(UUID(), 'telegram.chat_id',  '', 'TELEGRAM', 1),
(UUID(), 'line.channel_access_token', '', 'LINE', 1),
(UUID(), 'line.channel_secret', '', 'LINE', 1);

INSERT INTO `running_number_sequences` (`id`, `doc_type`, `prefix`, `year_format`, `current_number`, `reset_yearly`) VALUES
(UUID(), 'TICKET', '', 'CE', 0, 1),
(UUID(), 'ASSET',  'IT-', 'CE', 0, 0),
(UUID(), 'REPAIR_REQUEST', 'RR-', 'CE', 0, 1),
(UUID(), 'EXTERNAL_APPROVAL', 'EA-', 'CE', 0, 1);

-- =====================================================================================
-- 10. DOCUMENT TEMPLATES (registry เท่านั้น — เนื้อหาฟอร์มจริง render ฝั่ง frontend, ยังมีแค่ REPAIR_REQUEST
-- ที่ต่อสายใช้งานจริงแล้ว รอต้นแบบฟอร์มราชการอีก 13 แบบเพิ่มทีหลังโดยไม่ต้องแก้ engine)
-- =====================================================================================
INSERT INTO `document_templates` (`id`, `code`, `name_th`, `description`, `is_active`) VALUES
(UUID(), 'REPAIR_REQUEST', 'แบบฟอร์มการขอรับบริการซ่อมแซมคอมพิวเตอร์และอุปกรณ์', 'ใบแจ้งซ่อมที่พิมพ์จากหน้ารายละเอียดใบแจ้งซ่อม ออกเลขที่เอกสารอัตโนมัติทุกครั้งที่ออกเอกสารจริง', 1);

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================================
-- หมายเหตุความปลอดภัย: เปลี่ยนรหัสผ่าน admin ทันทีหลัง deploy จริง (must_change_password = 1 บังคับอยู่แล้ว)
-- Default password สำหรับ dev/test เท่านั้น: Admin@12345
-- =====================================================================================
