-- =====================================================================================
-- KHD-IT-SUP :: ระบบแจ้งซ่อมอุปกรณ์และระบบคอมพิวเตอร์ สำนักงานสาธารณสุขจังหวัดนครราชสีมา
-- IT Service Desk & Asset Maintenance Management System
-- Database: MariaDB 10.11+ / 11.x
-- Engine: InnoDB, Charset: utf8mb4, Collation: utf8mb4_unicode_ci
-- =====================================================================================
-- หมายเหตุ: ไฟล์นี้คือ "Complete Logical Schema" ตามสเปกเต็มของระบบ (Phase 0 deliverable)
-- Backend (Prisma) ใน Phase 1 เป็นต้นไปจะ implement เฉพาะตารางที่ module นั้นถึง Phase แล้ว
-- ดู docs/00-roadmap.md สำหรับลำดับการพัฒนา และ docs/03-database-design.md สำหรับคำอธิบาย
-- =====================================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO';

CREATE DATABASE IF NOT EXISTS `khd_it_sup` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `khd_it_sup`;

-- =====================================================================================
-- SECTION 1: RBAC (ROLES / PERMISSIONS / USERS)
-- =====================================================================================

CREATE TABLE `roles` (
  `id`            CHAR(36)     NOT NULL,
  `code`          VARCHAR(50)  NOT NULL,
  `name_th`       VARCHAR(150) NOT NULL,
  `name_en`       VARCHAR(150) NOT NULL,
  `description`   VARCHAR(255) NULL,
  `is_system`     TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_roles_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `permissions` (
  `id`            CHAR(36)     NOT NULL,
  `code`          VARCHAR(100) NOT NULL COMMENT 'e.g. asset:create, ticket:assign',
  `module`        VARCHAR(50)  NOT NULL COMMENT 'e.g. asset, ticket, user, settings',
  `description`   VARCHAR(255) NULL,
  `created_at`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_permissions_code` (`code`),
  KEY `idx_permissions_module` (`module`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `role_permissions` (
  `role_id`       CHAR(36) NOT NULL,
  `permission_id` CHAR(36) NOT NULL,
  `created_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`role_id`, `permission_id`),
  CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rp_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `departments` (
  `id`          CHAR(36)     NOT NULL,
  `code`        VARCHAR(50)  NOT NULL,
  `name_th`     VARCHAR(200) NOT NULL,
  `name_en`     VARCHAR(200) NULL,
  `parent_id`   CHAR(36)     NULL,
  `is_active`   TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_departments_code` (`code`),
  KEY `idx_departments_parent` (`parent_id`),
  CONSTRAINT `fk_departments_parent` FOREIGN KEY (`parent_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `positions` (
  `id`         CHAR(36)     NOT NULL,
  `code`       VARCHAR(50)  NOT NULL,
  `name_th`    VARCHAR(150) NOT NULL,
  `name_en`    VARCHAR(150) NULL,
  `is_active`  BOOLEAN      NOT NULL DEFAULT TRUE,
  `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_positions_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `users` (
  `id`               CHAR(36)     NOT NULL,
  `username`         VARCHAR(100) NOT NULL,
  `email`            VARCHAR(150) NOT NULL,
  `password_hash`    VARCHAR(255) NOT NULL,
  `full_name`        VARCHAR(200) NOT NULL,
  `phone`            VARCHAR(30)  NULL,
  `avatar_url`       VARCHAR(500) NULL,
  `gender`           ENUM('MALE','FEMALE') NULL COMMENT 'ใช้เลือกภาพ avatar เริ่มต้นเมื่อยังไม่อัปโหลดรูปโปรไฟล์',
  `employee_code`    VARCHAR(50)  NULL,
  `telegram_chat_id` VARCHAR(50)  NULL COMMENT 'ช่องทางแจ้งเตือน Telegram ส่วนตัวของผู้ใช้ (แยกจากกลุ่มไอทีกลาง)',
  `line_user_id`     VARCHAR(50)  NULL COMMENT 'ช่องทางแจ้งเตือน LINE ส่วนตัวของผู้ใช้ (แยกจากกลุ่มไอทีกลาง)',
  `role_id`          CHAR(36)     NOT NULL,
  `department_id`    CHAR(36)     NULL,
  `position_id`      CHAR(36)     NULL,
  `is_active`        TINYINT(1)   NOT NULL DEFAULT 1,
  `is_unit_head`     TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'เป็นหัวหน้างาน/กลุ่มงาน — ลงนามอนุมัติคำขอแจ้งซ่อมของบุคลากรในหน่วยงาน (department_id) เดียวกันได้',
  `must_change_password` TINYINT(1) NOT NULL DEFAULT 0,
  `last_login_at`    DATETIME(3)  NULL,
  `created_at`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `created_by`       CHAR(36)     NULL,
  `updated_by`       CHAR(36)     NULL,
  `deleted_at`       DATETIME(3)  NULL COMMENT 'soft delete',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_role` (`role_id`),
  KEY `idx_users_department` (`department_id`),
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_users_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_users_position` FOREIGN KEY (`position_id`) REFERENCES `positions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `refresh_tokens` (
  `id`             CHAR(36)     NOT NULL,
  `user_id`        CHAR(36)     NOT NULL,
  `token_hash`     VARCHAR(255) NOT NULL,
  `expires_at`     DATETIME(3)  NOT NULL,
  `revoked_at`     DATETIME(3)  NULL,
  `replaced_by_id` CHAR(36)     NULL,
  `created_by_ip`  VARCHAR(64)  NULL,
  `user_agent`     VARCHAR(255) NULL,
  `created_at`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_refresh_tokens_user` (`user_id`),
  KEY `idx_refresh_tokens_expires` (`expires_at`),
  CONSTRAINT `fk_refresh_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `password_reset_tokens` (
  `id`         CHAR(36)     NOT NULL,
  `user_id`    CHAR(36)     NOT NULL,
  `token_hash` VARCHAR(255) NOT NULL,
  `expires_at` DATETIME(3)  NOT NULL,
  `used_at`    DATETIME(3)  NULL,
  `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_prt_user` (`user_id`),
  CONSTRAINT `fk_prt_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pin_credentials` (
  `id`                 CHAR(36)     NOT NULL,
  `user_id`            CHAR(36)     NOT NULL,
  `device_secret_hash` VARCHAR(255) NOT NULL COMMENT 'sha256(device secret) — ค่าดิบเก็บเป็น httpOnly cookie เฉพาะเครื่องนั้น ไม่เก็บใน DB',
  `pin_hash`           VARCHAR(255) NOT NULL COMMENT 'bcrypt hash ของ PIN 6 หลัก',
  `device_label`       VARCHAR(150) NULL COMMENT 'ชื่ออุปกรณ์อ่านง่าย แปลงจาก User-Agent เช่น "Chrome บน Windows"',
  `failed_attempts`    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `locked_until`       DATETIME(3)  NULL COMMENT 'ล็อกชั่วคราวหลังใส่ PIN ผิดติดกันเกิน PIN_MAX_FAILED_ATTEMPTS',
  `expires_at`         DATETIME(3)  NOT NULL COMMENT 'อายุแบบ sliding — เลื่อนออกไปทุกครั้งที่ login ด้วย PIN สำเร็จ',
  `revoked_at`         DATETIME(3)  NULL,
  `last_used_at`       DATETIME(3)  NULL,
  `created_by_ip`      VARCHAR(64)  NULL,
  `user_agent`         VARCHAR(255) NULL,
  `created_at`         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pin_credentials_device_secret_hash` (`device_secret_hash`),
  KEY `idx_pin_credentials_user` (`user_id`),
  KEY `idx_pin_credentials_expires` (`expires_at`),
  CONSTRAINT `fk_pin_credentials_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================================
-- SECTION 2: LOCATION (BUILDING / FLOOR / ROOM) & VENDOR
-- =====================================================================================

CREATE TABLE `buildings` (
  `id`   CHAR(36)     NOT NULL,
  `code` VARCHAR(50)  NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_buildings_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `floors` (
  `id`          CHAR(36)     NOT NULL,
  `building_id` CHAR(36)     NOT NULL,
  `code`        VARCHAR(50)  NOT NULL,
  `name`        VARCHAR(150) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_floors_building` (`building_id`),
  CONSTRAINT `fk_floors_building` FOREIGN KEY (`building_id`) REFERENCES `buildings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `rooms` (
  `id`            CHAR(36)     NOT NULL,
  `floor_id`      CHAR(36)     NOT NULL,
  `department_id` CHAR(36)     NULL,
  `code`          VARCHAR(50)  NOT NULL,
  `name`          VARCHAR(150) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_rooms_floor` (`floor_id`),
  KEY `idx_rooms_department` (`department_id`),
  CONSTRAINT `fk_rooms_floor` FOREIGN KEY (`floor_id`) REFERENCES `floors` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rooms_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `divisions` (
  `id`            CHAR(36)     NOT NULL,
  `department_id` CHAR(36)     NOT NULL,
  `code`          VARCHAR(50)  NOT NULL,
  `name_th`       VARCHAR(150) NOT NULL,
  `name_en`       VARCHAR(150) NULL,
  `is_active`     BOOLEAN      NOT NULL DEFAULT TRUE,
  `created_at`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_divisions_code` (`code`),
  KEY `idx_divisions_department` (`department_id`),
  CONSTRAINT `fk_divisions_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `vendors` (
  `id`             CHAR(36)     NOT NULL,
  `code`           VARCHAR(50)  NOT NULL,
  `name`           VARCHAR(200) NOT NULL,
  `contact_person` VARCHAR(150) NULL,
  `phone`          VARCHAR(30)  NULL,
  `email`          VARCHAR(150) NULL,
  `address`        VARCHAR(500) NULL,
  `tax_id`         VARCHAR(30)  NULL,
  `is_active`      TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vendors_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================================
-- SECTION 3: ASSET MANAGEMENT
-- =====================================================================================

CREATE TABLE `asset_categories` (
  `id`              CHAR(36)     NOT NULL,
  `code`             VARCHAR(50)  NOT NULL COMMENT 'COMPUTER, NOTEBOOK, PRINTER, SCANNER, UPS, SWITCH, ROUTER, FIREWALL, SERVER, MONITOR, PROJECTOR, AC, MEDICAL, OTHER',
  `name_th`          VARCHAR(150) NOT NULL,
  `name_en`          VARCHAR(150) NOT NULL,
  `icon`             VARCHAR(100) NULL COMMENT 'HeroIcon name',
  `requires_serial`  TINYINT(1)   NOT NULL DEFAULT 1,
  `is_active`        TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_asset_categories_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `assets` (
  `id`                  CHAR(36)      NOT NULL,
  `asset_number`        VARCHAR(50)   NOT NULL COMMENT 'internal running number e.g. IT-2026-000123',
  `gov_asset_number`    VARCHAR(100)  NULL COMMENT 'เลขครุภัณฑ์ราชการ',
  `serial_number`       VARCHAR(150)  NULL,
  `model`               VARCHAR(150)  NULL,
  `brand`                VARCHAR(150)  NULL,
  `category_id`          CHAR(36)      NOT NULL,
  `department_id`        CHAR(36)      NULL,
  `building_id`          CHAR(36)      NULL,
  `floor_id`             CHAR(36)      NULL,
  `room_id`              CHAR(36)      NULL,
  `location_note`        VARCHAR(255)  NULL,
  `purchase_date`        DATE          NULL,
  `warranty_expire_date` DATE          NULL,
  `vendor_id`            CHAR(36)      NULL,
  `price`                DECIMAL(14,2) NULL,
  `photo_url`            VARCHAR(500)  NULL COMMENT 'primary photo, see asset_photos for gallery',
  `status`               ENUM('ACTIVE','IN_REPAIR','WAITING_PARTS','MAINTENANCE','RESERVED','INACTIVE','DISPOSED','LOST') NOT NULL DEFAULT 'ACTIVE',
  `acquisition_type`     ENUM('PURCHASE','LEASE_TO_OWN','LEASE_USE','DONATED','BORROWED','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN' COMMENT 'ประเภทการได้มา: ซื้อ/เช่า-ซื้อ/เช่า-ใช้/บริจาค/ยืมตัวชั่วคราว/ไม่ทราบ',
  `owner_user_id`        CHAR(36)      NULL COMMENT 'ผู้ครอบครอง/ผู้รับผิดชอบ',
  `remark`               TEXT          NULL,
  `external_source`      VARCHAR(50)   NULL COMMENT 'ระบบต้นทางถ้านำเข้าอัตโนมัติ เช่น MOPH_ASSETTRACKER — NULL = สร้างเองในระบบนี้',
  `external_id`          VARCHAR(50)   NULL COMMENT 'เลข id ของระบบต้นทาง (เช่น id ใน MOPH AssetTracker) — อ้างอิงเท่านั้น ไม่ใช่ key สำหรับ upsert',
  `external_synced_at`   DATETIME(3)   NULL COMMENT 'เวลา sync ล่าสุดที่แตะแถวนี้ (เฉพาะแถวที่มี external_source)',
  `unit_type`             VARCHAR(50)   NULL COMMENT 'หน่วยนับ เช่น เครื่อง, อัน',
  `budget_year`           VARCHAR(10)   NULL COMMENT 'ปีงบประมาณจากระบบต้นทาง (ข้อมูลดิบ ไม่แปลง พ.ศ./ค.ศ.)',
  `equip_classification_code` VARCHAR(20)  NULL COMMENT 'รหัสจำแนกครุภัณฑ์ราชการ (equip_class จาก MOPH)',
  `equip_classification_name` VARCHAR(150) NULL COMMENT 'ชื่อจำแนกครุภัณฑ์ราชการ (equip_sub_name จาก MOPH)',
  `created_at`           DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`           DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `created_by`           CHAR(36)      NULL,
  `updated_by`           CHAR(36)      NULL,
  `deleted_at`           DATETIME(3)   NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_assets_asset_number` (`asset_number`),
  UNIQUE KEY `uq_assets_gov_asset_number` (`gov_asset_number`),
  KEY `idx_assets_category` (`category_id`),
  KEY `idx_assets_department` (`department_id`),
  KEY `idx_assets_status` (`status`),
  KEY `idx_assets_serial` (`serial_number`),
  FULLTEXT KEY `ftx_assets_search` (`model`, `brand`, `serial_number`, `gov_asset_number`),
  CONSTRAINT `fk_assets_category` FOREIGN KEY (`category_id`) REFERENCES `asset_categories` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_assets_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_assets_building` FOREIGN KEY (`building_id`) REFERENCES `buildings` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_assets_floor` FOREIGN KEY (`floor_id`) REFERENCES `floors` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_assets_room` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_assets_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_assets_owner` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `asset_loans` (
  `id`                    CHAR(36)     NOT NULL,
  `asset_id`              CHAR(36)     NOT NULL,
  `borrower_id`           CHAR(36)     NOT NULL,
  `recorded_by`           CHAR(36)     NOT NULL,
  `returned_by`           CHAR(36)     NULL,
  `borrow_date`           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expected_return_date`  DATE         NULL,
  `actual_return_date`    DATETIME(3)  NULL,
  `purpose`               VARCHAR(500) NULL,
  `condition_on_borrow`   VARCHAR(500) NULL,
  `condition_on_return`   VARCHAR(500) NULL,
  `created_at`            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_asset_loans_asset` (`asset_id`),
  KEY `idx_asset_loans_borrower` (`borrower_id`),
  KEY `idx_asset_loans_recorded_by` (`recorded_by`),
  CONSTRAINT `fk_asset_loans_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_asset_loans_borrower` FOREIGN KEY (`borrower_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_asset_loans_recorded_by` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_asset_loans_returned_by` FOREIGN KEY (`returned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `asset_photos` (
  `id`          CHAR(36)     NOT NULL,
  `asset_id`    CHAR(36)     NOT NULL,
  `file_url`    VARCHAR(500) NOT NULL,
  `caption`     VARCHAR(255) NULL,
  `uploaded_by` CHAR(36)     NULL,
  `uploaded_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_asset_photos_asset` (`asset_id`),
  CONSTRAINT `fk_asset_photos_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `asset_qrcodes` (
  `id`            CHAR(36)     NOT NULL,
  `asset_id`      CHAR(36)     NOT NULL,
  `qr_token`      VARCHAR(255) NOT NULL COMMENT 'AES-encrypted asset reference, ใช้ยืนยันตัวจริงตอน resolve เสมอ',
  `short_code`    VARCHAR(20)  NULL COMMENT 'รหัสสั้นแบบสุ่ม ใช้แทน qr_token ตอนพิมพ์ QR จริง (ผ่าน /s/:shortCode redirect ไป qr_token) เพื่อให้ QR หนาแน่นน้อยลง สแกนง่ายขึ้น',
  `qr_image_url`  VARCHAR(500) NULL,
  `is_active`     TINYINT(1)   NOT NULL DEFAULT 1,
  `generated_by`  CHAR(36)     NULL,
  `generated_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_asset_qrcodes_asset` (`asset_id`),
  UNIQUE KEY `uq_asset_qrcodes_token` (`qr_token`),
  UNIQUE KEY `uq_asset_qrcodes_short_code` (`short_code`),
  CONSTRAINT `fk_asset_qrcodes_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `qr_scan_logs` (
  `id`         CHAR(36)     NOT NULL,
  `asset_id`   CHAR(36)     NOT NULL,
  `scanned_by` CHAR(36)     NULL COMMENT 'null = anonymous/public scan',
  `ip_address` VARCHAR(64)  NULL,
  `user_agent` VARCHAR(255) NULL,
  `scanned_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_qr_scan_logs_asset` (`asset_id`),
  CONSTRAINT `fk_qr_scan_logs_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================================
-- SECTION 4: WORKFLOW ENGINE (CONFIGURABLE STATE MACHINE)
-- =====================================================================================

CREATE TABLE `workflow_templates` (
  `id`          CHAR(36)     NOT NULL,
  `code`        VARCHAR(50)  NOT NULL,
  `name`        VARCHAR(200) NOT NULL,
  `applies_to`  ENUM('REPAIR_INTERNAL','REPAIR_EXTERNAL') NOT NULL,
  `version`     INT          NOT NULL DEFAULT 1,
  `is_active`   TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_workflow_templates_code_version` (`code`, `version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `workflow_steps` (
  `id`                  CHAR(36)     NOT NULL,
  `template_id`         CHAR(36)     NOT NULL,
  `step_code`           VARCHAR(50)  NOT NULL COMMENT 'e.g. SUBMITTED, RECEIVED, DIAGNOSIS, REPAIRING, COMPLETED',
  `step_name_th`        VARCHAR(150) NOT NULL,
  `step_name_en`        VARCHAR(150) NOT NULL,
  `step_order`          INT          NOT NULL,
  `responsible_role_id` CHAR(36)     NULL,
  `sla_hours`           INT          NULL COMMENT 'null = ไม่กำหนด SLA',
  `requires_approval`   TINYINT(1)   NOT NULL DEFAULT 0,
  `color_code`          VARCHAR(20)  NULL COMMENT 'e.g. #006C45',
  `is_terminal`         TINYINT(1)   NOT NULL DEFAULT 0,
  `notify_on_enter`     TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_workflow_steps_template_code` (`template_id`, `step_code`),
  KEY `idx_workflow_steps_role` (`responsible_role_id`),
  CONSTRAINT `fk_workflow_steps_template` FOREIGN KEY (`template_id`) REFERENCES `workflow_templates` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_workflow_steps_role` FOREIGN KEY (`responsible_role_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `workflow_transitions` (
  `id`             CHAR(36)     NOT NULL,
  `template_id`    CHAR(36)     NOT NULL,
  `from_step_id`   CHAR(36)     NULL COMMENT 'null = จุดเริ่มต้น workflow',
  `to_step_id`     CHAR(36)     NOT NULL,
  `condition_key`  VARCHAR(100) NULL COMMENT 'e.g. DECISION=INTERNAL / DECISION=EXTERNAL',
  `label`          VARCHAR(150) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_workflow_transitions_from` (`from_step_id`),
  KEY `idx_workflow_transitions_to` (`to_step_id`),
  CONSTRAINT `fk_workflow_transitions_template` FOREIGN KEY (`template_id`) REFERENCES `workflow_templates` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_workflow_transitions_from` FOREIGN KEY (`from_step_id`) REFERENCES `workflow_steps` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_workflow_transitions_to` FOREIGN KEY (`to_step_id`) REFERENCES `workflow_steps` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `workflow_instances` (
  `id`               CHAR(36)     NOT NULL,
  `template_id`      CHAR(36)     NOT NULL,
  `entity_type`      ENUM('REPAIR_TICKET') NOT NULL DEFAULT 'REPAIR_TICKET',
  `entity_id`        CHAR(36)     NOT NULL,
  `current_step_id`  CHAR(36)     NOT NULL,
  `status`           ENUM('RUNNING','COMPLETED','CANCELLED') NOT NULL DEFAULT 'RUNNING',
  `started_at`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completed_at`     DATETIME(3)  NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_workflow_instances_entity` (`entity_type`, `entity_id`),
  KEY `idx_workflow_instances_step` (`current_step_id`),
  CONSTRAINT `fk_workflow_instances_template` FOREIGN KEY (`template_id`) REFERENCES `workflow_templates` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_workflow_instances_step` FOREIGN KEY (`current_step_id`) REFERENCES `workflow_steps` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================================
-- SECTION 5: REPAIR TICKET
-- =====================================================================================

CREATE TABLE `repair_tickets` (
  `id`                    CHAR(36)     NOT NULL,
  `ticket_number`         VARCHAR(50)  NOT NULL COMMENT 'e.g. 2026-000125',
  `asset_id`               CHAR(36)     NULL COMMENT 'null = แจ้งซ่อมแบบไม่ระบุครุภัณฑ์',
  `reported_by_user_id`    CHAR(36)     NOT NULL,
  `department_id`          CHAR(36)     NULL,
  `problem_type`           VARCHAR(100) NULL,
  `description`            TEXT         NOT NULL,
  `urgency`                ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'MEDIUM',
  `location_note`          VARCHAR(255) NULL,
  `contact_phone`          VARCHAR(30)  NULL,
  `status`                 VARCHAR(50)  NOT NULL DEFAULT 'DRAFT' COMMENT 'mirrors current workflow_steps.step_code',
  `workflow_instance_id`   CHAR(36)     NULL,
  `assigned_technician_id` CHAR(36)     NULL,
  `estimated_finish_at`    DATETIME(3)  NULL,
  `sla_due_at`             DATETIME(3)  NULL,
  `created_at`             DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`             DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `closed_at`              DATETIME(3)  NULL,
  `cancelled_at`           DATETIME(3)  NULL,
  `cancel_reason`          VARCHAR(500) NULL,
  `root_cause`             TEXT         NULL COMMENT 'สรุปผลการซ่อมจากช่าง: สาเหตุที่พบ',
  `repair_action`          TEXT         NULL COMMENT 'สรุปผลการซ่อมจากช่าง: วิธีการดำเนินการซ่อม',
  `parts_used`             TEXT         NULL COMMENT 'สรุปผลการซ่อมจากช่าง: อะไหล่/อุปกรณ์ที่ใช้',
  `recommendation`         TEXT         NULL COMMENT 'สรุปผลการซ่อมจากช่าง: ข้อเสนอแนะ/คำแนะนำป้องกัน',
  `summary_by_user_id`     CHAR(36)     NULL COMMENT 'ช่างผู้บันทึกสรุปผลการซ่อม',
  `summary_at`             DATETIME(3)  NULL,
  `summary_signature`      MEDIUMTEXT   NULL COMMENT 'ลายเซ็นช่างผู้ซ่อม (base64 PNG data URL จาก signature pad บนมือถือ/เว็บ)',

  -- ส่วนที่ 1 ของแบบฟอร์มกระดาษ: ข้อมูลอุปกรณ์/อุปกรณ์เสริมที่ผู้แจ้งซ่อมกรอกตอนแจ้ง
  `equipment_type`       VARCHAR(30)  NULL COMMENT 'COMPUTER_CASE|NOTEBOOK|PRINTER|SCANNER|MONITOR|OTHER',
  `equipment_type_other` VARCHAR(150) NULL,
  `device_color`         VARCHAR(50)  NULL,
  `has_adapter_cable`    TINYINT(1)   NOT NULL DEFAULT 0,
  `has_vga_cable`        TINYINT(1)   NOT NULL DEFAULT 0,
  `has_power_cable`      TINYINT(1)   NOT NULL DEFAULT 0,
  `has_other_accessory`  TINYINT(1)   NOT NULL DEFAULT 0,
  `other_accessory_note` VARCHAR(255) NULL,

  -- ส่วนที่ 1: ลงนามหัวหน้างาน/กลุ่มงานของผู้แจ้งซ่อม (endorsement เท่านั้น ไม่ใช่ workflow gate)
  `unit_head_approved_by` CHAR(36)    NULL,
  `unit_head_approved_at` DATETIME(3) NULL,

  -- ส่วนที่ 2 ของแบบฟอร์มกระดาษ: ผลตรวจสอบเบื้องต้นโดยเจ้าหน้าที่ไอที (ก่อนเริ่มซ่อมจริง)
  `inspected_by`          CHAR(36)     NULL,
  `inspected_at`          DATETIME(3)  NULL,
  `inspection_outcome`    VARCHAR(20)  NULL COMMENT 'IN_HOUSE|SEND_EXTERNAL|REPLACE_NEW',
  `request_parts_needed`  TINYINT(1)   NOT NULL DEFAULT 0,
  `requested_part1_name`  VARCHAR(200) NULL,
  `requested_part1_qty`   INT          NULL,
  `requested_part2_name`  VARCHAR(200) NULL,
  `requested_part2_qty`   INT          NULL,
  `requested_part3_name`  VARCHAR(200) NULL,
  `requested_part3_qty`   INT          NULL,
  `send_external_reason`  TEXT         NULL,

  -- ส่วนที่ 2: ลงนามหัวหน้ากลุ่มงานสุขภาพดิจิทัล (endorsement เท่านั้น ไม่ใช่ workflow gate)
  `digital_health_head_approved_by` CHAR(36)    NULL,
  `digital_health_head_approved_at` DATETIME(3) NULL,

  -- เซ็นรับงานคืน (ผู้ตรวจรับงาน) — ผู้แจ้งซ่อมเซ็นเองตอนสถานะ "ผู้แจ้งรับมอบ" ผ่าน ticket:accept (self-service เฉพาะของตน)
  -- ถ้าแอดมินปิดงานแทนด้วย ticket:close (ไม่มีลายเซ็น) จะเป็น NULL ทั้งคู่
  `accepted_by_user_id`   CHAR(36)     NULL,
  `acceptor_signature`    MEDIUMTEXT   NULL COMMENT 'ลายเซ็นผู้ตรวจรับงาน (base64 PNG data URL จาก signature pad บนมือถือ/เว็บ)',

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_repair_tickets_number` (`ticket_number`),
  KEY `idx_repair_tickets_asset` (`asset_id`),
  KEY `idx_repair_tickets_reporter` (`reported_by_user_id`),
  KEY `idx_repair_tickets_status` (`status`),
  KEY `idx_repair_tickets_technician` (`assigned_technician_id`),
  KEY `idx_repair_tickets_created` (`created_at`),
  CONSTRAINT `fk_repair_tickets_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_repair_tickets_reporter` FOREIGN KEY (`reported_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_repair_tickets_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_repair_tickets_technician` FOREIGN KEY (`assigned_technician_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_repair_tickets_workflow_instance` FOREIGN KEY (`workflow_instance_id`) REFERENCES `workflow_instances` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_repair_tickets_summary_by` FOREIGN KEY (`summary_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_repair_tickets_unit_head` FOREIGN KEY (`unit_head_approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_repair_tickets_inspected_by` FOREIGN KEY (`inspected_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_repair_tickets_dh_head` FOREIGN KEY (`digital_health_head_approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_repair_tickets_accepted_by` FOREIGN KEY (`accepted_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `repair_ticket_attachments` (
  `id`          CHAR(36)     NOT NULL,
  `ticket_id`   CHAR(36)     NOT NULL,
  `file_url`    VARCHAR(500) NOT NULL,
  `file_type`   VARCHAR(50)  NULL,
  `caption`     VARCHAR(255) NULL,
  `uploaded_by` CHAR(36)     NULL,
  `uploaded_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_rt_attachments_ticket` (`ticket_id`),
  CONSTRAINT `fk_rt_attachments_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `repair_tickets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================================
-- SECTION 6: IMMUTABLE TIMELINE (repair / approval / audit ผสมกันในโครงเดียว ผ่าน event_type)
-- =====================================================================================

CREATE TABLE `repair_ticket_timeline` (
  `id`                    CHAR(36)     NOT NULL,
  `ticket_id`              CHAR(36)     NOT NULL,
  `event_time`             DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `event_type`             VARCHAR(50)  NOT NULL COMMENT 'SUBMIT, ASSIGN, STATUS_CHANGE, APPROVAL, COMMENT, ATTACHMENT, NOTIFICATION, QR_SCAN, VENDOR, INVENTORY, PM',
  `previous_status`        VARCHAR(50)  NULL,
  `current_status`         VARCHAR(50)  NOT NULL,
  `responsible_user_id`    CHAR(36)     NULL,
  `department_id`          CHAR(36)     NULL,
  `comment`                TEXT         NULL,
  `attachment_url`         VARCHAR(500) NULL,
  `attachment_urls`       JSON         NULL COMMENT 'ไฟล์แนบทั้งหมดของ event นี้ (array ของ {fileUrl, fileType}) — attachment_url เดี่ยวเก็บไว้เพื่อ backward-compat',
  `approval_result`        ENUM('WAITING','APPROVED','REJECTED','RETURNED','SKIPPED') NULL,
  `signature_url`          VARCHAR(500) NULL,
  `gps_lat`                DECIMAL(10,7) NULL,
  `gps_lng`                DECIMAL(10,7) NULL,
  `ip_address`             VARCHAR(64)  NULL,
  `elapsed_seconds`        INT          NULL COMMENT 'เวลาที่ใช้นับจาก event ก่อนหน้า',
  `sla_remaining_seconds`  INT          NULL,
  `created_at`             DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_timeline_ticket` (`ticket_id`, `event_time`),
  KEY `idx_timeline_type` (`event_type`),
  KEY `idx_timeline_user` (`responsible_user_id`),
  CONSTRAINT `fk_timeline_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `repair_tickets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_timeline_user` FOREIGN KEY (`responsible_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_timeline_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Immutability enforcement: ห้าม UPDATE / DELETE แถวใน timeline โดยเด็ดขาด (insert-only ledger)
DELIMITER $$
CREATE TRIGGER `trg_timeline_no_update`
BEFORE UPDATE ON `repair_ticket_timeline`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'repair_ticket_timeline is append-only: UPDATE is not permitted';
END$$

CREATE TRIGGER `trg_timeline_no_delete`
BEFORE DELETE ON `repair_ticket_timeline`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'repair_ticket_timeline is append-only: DELETE is not permitted';
END$$
DELIMITER ;

CREATE TABLE `approvals` (
  `id`                CHAR(36)     NOT NULL,
  `ticket_id`          CHAR(36)     NOT NULL,
  `workflow_step_id`   CHAR(36)     NULL,
  `sequence_order`     INT          NOT NULL DEFAULT 1,
  `approver_user_id`   CHAR(36)     NULL,
  `approver_role_id`   CHAR(36)     NULL,
  `result`             ENUM('WAITING','APPROVED','REJECTED','RETURNED','SKIPPED') NOT NULL DEFAULT 'WAITING',
  `comment`            VARCHAR(1000) NULL,
  `signature_url`      VARCHAR(500) NULL,
  `decided_at`         DATETIME(3)  NULL,
  `created_at`         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_approvals_ticket` (`ticket_id`),
  KEY `idx_approvals_approver` (`approver_user_id`),
  CONSTRAINT `fk_approvals_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `repair_tickets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_approvals_step` FOREIGN KEY (`workflow_step_id`) REFERENCES `workflow_steps` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_approvals_approver_user` FOREIGN KEY (`approver_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_approvals_approver_role` FOREIGN KEY (`approver_role_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================================
-- SECTION 7: INVENTORY / SPARE PARTS
-- =====================================================================================

CREATE TABLE `spare_parts` (
  `id`             CHAR(36)      NOT NULL,
  `code`           VARCHAR(50)   NOT NULL,
  `name`           VARCHAR(200)  NOT NULL,
  `unit`           VARCHAR(30)   NOT NULL DEFAULT 'ชิ้น',
  `quantity_on_hand` INT         NOT NULL DEFAULT 0,
  `reorder_level`  INT           NOT NULL DEFAULT 0,
  `unit_cost`      DECIMAL(14,2) NULL,
  `created_at`     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_spare_parts_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `spare_part_transactions` (
  `id`             CHAR(36)     NOT NULL,
  `spare_part_id`  CHAR(36)     NOT NULL,
  `ticket_id`      CHAR(36)     NULL,
  `type`           ENUM('RESERVE','ISSUE','RETURN','ADJUST','PURCHASE','RECEIVE') NOT NULL,
  `quantity`       INT          NOT NULL,
  `balance_after`  INT          NOT NULL,
  `performed_by`   CHAR(36)     NULL,
  `note`           VARCHAR(500) NULL,
  `created_at`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_spt_spare_part` (`spare_part_id`),
  KEY `idx_spt_ticket` (`ticket_id`),
  CONSTRAINT `fk_spt_spare_part` FOREIGN KEY (`spare_part_id`) REFERENCES `spare_parts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_spt_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `repair_tickets` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================================
-- SECTION 8: VENDOR / EXTERNAL REPAIR
-- =====================================================================================

CREATE TABLE `vendor_repair_orders` (
  `id`                 CHAR(36)      NOT NULL,
  `ticket_id`          CHAR(36)      NOT NULL,
  `vendor_id`          CHAR(36)      NOT NULL,
  `quotation_amount`   DECIMAL(14,2) NULL,
  `quotation_file_url` VARCHAR(500)  NULL,
  `po_number`          VARCHAR(50)   NULL,
  `sent_at`            DATETIME(3)   NULL,
  `received_at`        DATETIME(3)   NULL,
  `invoice_file_url`   VARCHAR(500)  NULL,
  `warranty_until`     DATE          NULL,
  `status`             ENUM('QUOTATION_REQUESTED','QUOTATION_RECEIVED','APPROVED','PO_GENERATED','SENT','IN_REPAIR','RETURNED','INSPECTED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'QUOTATION_REQUESTED',
  `created_at`         DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`         DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_vro_ticket` (`ticket_id`),
  KEY `idx_vro_vendor` (`vendor_id`),
  CONSTRAINT `fk_vro_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `repair_tickets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_vro_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================================
-- SECTION 9: DOCUMENT GENERATION
-- =====================================================================================

CREATE TABLE `document_templates` (
  `id`                CHAR(36)     NOT NULL,
  `code`              VARCHAR(50)  NOT NULL COMMENT 'REPAIR_REQUEST, REPAIR_RECEIVE, EXTERNAL_APPROVAL, ...',
  `name_th`           VARCHAR(200) NOT NULL,
  `description`       VARCHAR(500) NULL,
  `is_active`         TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_document_templates_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `generated_documents` (
  `id`              CHAR(36)     NOT NULL,
  `ticket_id`       CHAR(36)     NULL,
  `template_code`   VARCHAR(50)  NOT NULL,
  `running_number`  VARCHAR(50)  NOT NULL,
  `file_url`        VARCHAR(500) NOT NULL,
  `signature_url`   VARCHAR(500) NULL,
  `qr_verify_token` VARCHAR(255) NULL,
  `generated_by`    CHAR(36)     NULL,
  `generated_at`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_generated_documents_running_number` (`running_number`),
  KEY `idx_generated_documents_ticket` (`ticket_id`),
  CONSTRAINT `fk_generated_documents_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `repair_tickets` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================================
-- SECTION 10: NOTIFICATIONS
-- =====================================================================================

CREATE TABLE `notification_logs` (
  `id`                  CHAR(36)     NOT NULL,
  `channel`             ENUM('EMAIL','TELEGRAM','LINE','PUSH','SMS') NOT NULL,
  `recipient`           VARCHAR(255) NOT NULL,
  `subject`             VARCHAR(255) NULL,
  `message`             TEXT         NOT NULL,
  `related_entity_type` VARCHAR(50)  NULL,
  `related_entity_id`   CHAR(36)     NULL,
  `status`              ENUM('PENDING','SENT','FAILED','READ') NOT NULL DEFAULT 'PENDING',
  `sent_at`             DATETIME(3)  NULL,
  `read_at`             DATETIME(3)  NULL,
  `error_message`       VARCHAR(500) NULL,
  `created_at`          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_notification_logs_entity` (`related_entity_type`, `related_entity_id`),
  KEY `idx_notification_logs_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================================
-- SECTION 11: SYSTEM SETTINGS
-- =====================================================================================

CREATE TABLE `system_settings` (
  `id`            CHAR(36)     NOT NULL,
  `setting_key`   VARCHAR(100) NOT NULL,
  `setting_value` TEXT         NULL,
  `category`      VARCHAR(50)  NOT NULL COMMENT 'SMTP, TELEGRAM, LINE, ORGANIZATION, THEME, BACKUP',
  `is_secret`     TINYINT(1)   NOT NULL DEFAULT 0,
  `updated_by`    CHAR(36)     NULL,
  `updated_at`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_system_settings_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `running_number_sequences` (
  `id`            CHAR(36)     NOT NULL,
  `doc_type`      VARCHAR(50)  NOT NULL COMMENT 'TICKET, REPAIR_REQUEST, EXTERNAL_APPROVAL, ASSET, ...',
  `prefix`        VARCHAR(20)  NULL,
  `year_format`   VARCHAR(10)  NULL COMMENT 'BE (พ.ศ.) or CE (ค.ศ.)',
  `current_number` BIGINT      NOT NULL DEFAULT 0,
  `reset_yearly`  TINYINT(1)   NOT NULL DEFAULT 1,
  `updated_at`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_running_number_doc_type` (`doc_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================================
-- SECTION 12: AUDIT LOG (insert-only) & BACKUP LOG
-- =====================================================================================

CREATE TABLE `audit_logs` (
  `id`           CHAR(36)     NOT NULL,
  `user_id`      CHAR(36)     NULL,
  `action`       VARCHAR(50)  NOT NULL COMMENT 'LOGIN, LOGOUT, CREATE, UPDATE, DELETE, PRINT, EXPORT, IMPORT, APPROVE, CONFIG_CHANGE',
  `module`       VARCHAR(50)  NOT NULL,
  `entity_type`  VARCHAR(50)  NULL,
  `entity_id`    VARCHAR(100) NULL,
  `description`  VARCHAR(500) NULL,
  `ip_address`   VARCHAR(64)  NULL,
  `user_agent`   VARCHAR(255) NULL,
  `before_data`  JSON         NULL,
  `after_data`   JSON         NULL,
  `created_at`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_audit_logs_user` (`user_id`),
  KEY `idx_audit_logs_module` (`module`),
  KEY `idx_audit_logs_entity` (`entity_type`, `entity_id`),
  KEY `idx_audit_logs_created` (`created_at`),
  CONSTRAINT `fk_audit_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER $$
CREATE TRIGGER `trg_audit_logs_no_update`
BEFORE UPDATE ON `audit_logs`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_logs is append-only: UPDATE is not permitted';
END$$

CREATE TRIGGER `trg_audit_logs_no_delete`
BEFORE DELETE ON `audit_logs`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_logs is append-only: DELETE is not permitted';
END$$
DELIMITER ;

CREATE TABLE `backup_logs` (
  `id`             CHAR(36)      NOT NULL,
  `type`           ENUM('MANUAL','AUTOMATIC') NOT NULL,
  `file_name`      VARCHAR(255)  NOT NULL,
  `file_size_bytes` BIGINT       NULL,
  `status`         ENUM('SUCCESS','FAILED') NOT NULL,
  `triggered_by`   CHAR(36)      NULL,
  `started_at`     DATETIME(3)   NOT NULL,
  `finished_at`    DATETIME(3)   NULL,
  `error_message`  VARCHAR(500)  NULL,
  PRIMARY KEY (`id`),
  KEY `idx_backup_logs_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================================
-- END OF SCHEMA — ดู database/seed.sql สำหรับข้อมูลตั้งต้น (roles, permissions, admin user, ...)
-- =====================================================================================
