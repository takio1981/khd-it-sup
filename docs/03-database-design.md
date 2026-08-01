# 3. Database Design

**Engine:** MariaDB 10.11+ / InnoDB · **Charset:** utf8mb4_unicode_ci · **PK strategy:** `CHAR(36)` UUID (v4)
**ที่มาไฟล์จริง:** [`database/schema.sql`](../database/schema.sql) (DDL ทั้งหมด) · [`database/seed.sql`](../database/seed.sql) (ข้อมูลตั้งต้น)

> ทำไมใช้ UUID แทน AUTO_INCREMENT: (1) ป้องกันการเดา ID เพื่อสแกน asset/ticket อื่นผ่าน QR/URL (2) รองรับการ sync/merge
> ข้อมูลข้ามฐาน (เช่น หากในอนาคตแยกเป็น microservice หรือมีหลาย instance) (3) generate ID ฝั่ง client/service ได้ก่อน insert จริง

## 3.1 กลุ่มตาราง (12 Sections)

| Section | ตาราง | หน้าที่ |
|---|---|---|
| 1. RBAC | `roles`, `permissions`, `role_permissions`, `departments`, `divisions`, `positions`, `users`, `refresh_tokens`, `password_reset_tokens` | ผู้ใช้ สิทธิ์ หน่วยงาน/แผนก และ session |
| 2. Location/Vendor | `buildings`, `floors`, `rooms`, `vendors` | ตำแหน่งครุภัณฑ์ และผู้ขาย/ผู้รับซ่อมภายนอก |
| 3. Asset | `asset_categories`, `assets`, `asset_loans`, `asset_photos`, `asset_qrcodes`, `qr_scan_logs` | ครุภัณฑ์ทุกประเภท, ยืม-คืน, รูปภาพ, QR Code, ประวัติการสแกน |
| 4. Workflow Engine | `workflow_templates`, `workflow_steps`, `workflow_transitions`, `workflow_instances` | State machine ที่ config ได้ (ข้อ 37 ในสเปก) |
| 5. Repair Ticket | `repair_tickets`, `repair_ticket_attachments` | ใบแจ้งซ่อมและไฟล์แนบ |
| 6. Timeline/Approval | `repair_ticket_timeline` (immutable), `approvals` | ประวัติทุก event แบบลบไม่ได้ + ผลการอนุมัติ |
| 7. Inventory | `spare_parts`, `spare_part_transactions` | คลังอะไหล่ |
| 8. Vendor Repair | `vendor_repair_orders` | ขั้นตอนซ่อมภายนอก |
| 9. Document | `document_templates`, `generated_documents` | เอกสารราชการที่พิมพ์แล้ว + running number |
| 10. Notification | `notification_logs` | ประวัติการแจ้งเตือนทุกช่องทาง (Email/Telegram/LINE/**Push**) + inbox แจ้งเตือนในแอป |
| 11. Settings | `system_settings`, `running_number_sequences` | ค่าคอนฟิกระบบ (SMTP/Telegram/LINE/Org/Theme), เลขที่เอกสารรันอัตโนมัติ |
| 12. Audit/Backup | `audit_logs` (immutable), `backup_logs` | บันทึกทุกการกระทำ + ประวัติสำรองข้อมูล |

> **สถานะการพัฒนา ณ ปัจจุบัน**: ตารางทั้งหมดข้างต้นถูกสร้างจริงใน `database/schema.sql` แล้ว แต่บาง section
> (7. Inventory, 8. Vendor Repair, 9. Document, และ `approvals` ใน section 6) ยังไม่มีโค้ด backend/frontend ใช้งาน
> (ยังไม่มี module ผูกอยู่) — เตรียมโครงไว้รองรับ Phase ถัดไปตาม [docs/00-roadmap.md](00-roadmap.md) ส่วน
> `backup_logs` ก็มีไว้รองรับระบบสำรองข้อมูลผ่าน UI ในอนาคต (ปัจจุบัน backup ทำผ่าน cron + `mariadb-dump` ตาม
> [docs/07-deployment-guide.md](07-deployment-guide.md) §7.4 โดยตรง ไม่ได้บันทึกลงตารางนี้)
>
> `users` มีคอลัมน์ `gender` (`MALE`/`FEMALE`, ใช้เลือก avatar เริ่มต้น), `avatar_url`, `telegram_chat_id`,
> `line_user_id` (ช่องทางแจ้งเตือนส่วนตัวแยกจากกลุ่มไอทีกลาง) เพิ่มเข้ามาระหว่างการพัฒนา — ดู
> [docs/08-user-manual.md](08-user-manual.md) และ [docs/09-admin-manual.md](09-admin-manual.md)

## 3.2 ตารางหัวใจของระบบ: Workflow Engine

```
workflow_templates (1) ──< workflow_steps (N) ──< workflow_transitions (N, from/to self-reference)
        │
        └──< workflow_instances (N) ──> current_step_id → workflow_steps
                     ▲
repair_tickets.workflow_instance_id ─┘
```

- 1 `workflow_templates` = 1 ผังงาน (เช่น `REPAIR_INTERNAL` v1) มีหลาย `workflow_steps` เรียงลำดับด้วย `step_order`
- `workflow_transitions.from_step_id = NULL` หมายถึงจุดเริ่มต้นของ workflow
- `condition_key` ใช้แยกกรณี branch เช่น `DECISION=INTERNAL` / `DECISION=EXTERNAL` หรือ `NEED_PARTS` / `READY_REPAIR`
- 1 ticket ผูกกับ 1 `workflow_instances` (unique `entity_type + entity_id`) ที่ชี้ไปยัง step ปัจจุบัน

## 3.3 Immutable Timeline

`repair_ticket_timeline` และ `audit_logs` เป็น **insert-only ledger**:

- ไม่มีคอลัมน์ `updated_at` หรือ `deleted_at`
- มี MariaDB **TRIGGER** (`trg_timeline_no_update`, `trg_timeline_no_delete`, `trg_audit_logs_no_update`, `trg_audit_logs_no_delete`)
  ที่ `SIGNAL SQLSTATE '45000'` ปฏิเสธคำสั่ง UPDATE/DELETE ที่ระดับฐานข้อมูลโดยตรง — ป้องกันแม้แต่การแก้ไขผ่าน SQL client ตรง ๆ
  ไม่ใช่แค่ระดับ ORM/Service เท่านั้น
- Service layer (`TimelineService`) มีเมธอด `recordEvent()` เพียงตัวเดียวสำหรับเขียนข้อมูล — ไม่มีเมธอก update/delete ให้เรียกใช้แต่แรก

## 3.4 Soft Delete Policy

ตารางที่มี `deleted_at` (`users`, `assets`) ใช้ soft-delete (Prisma middleware กรอง `deleted_at IS NULL` อัตโนมัติ)
เพื่อรักษาความสัมพันธ์กับ `repair_tickets`/`audit_logs` ในอดีต ตารางอื่นที่ไม่กระทบ integrity ทางประวัติศาสตร์ (เช่น `vendors`,
`spare_parts`) ใช้ flag `is_active` แทนการลบจริง

## 3.5 Indexing Strategy

- **Unique index** บนทุกรหัสที่ใช้ค้นหา/อ้างอิงจากภายนอก: `asset_number`, `ticket_number`, `qr_token`, `username`, `email`
- **Composite index** `(ticket_id, event_time)` บน timeline เพื่อ query ตามลำดับเวลาต่อ ticket ได้เร็ว
- **FULLTEXT index** บน `assets(model, brand, serial_number, gov_asset_number)` รองรับการค้นหาแบบ keyword จาก UI
- **Foreign key column ทุกตัวมี index** (MariaDB ไม่สร้างอัตโนมัติเหมือน PK เสมอไป จึงประกาศ index ตรง ๆ)

## 3.6 Prisma Schema

Prisma schema (`backend/prisma/schema.prisma`) map 1:1 กับ `database/schema.sql` — แต่ **`schema.sql` คือ source of
truth เสมอ**: ตามนโยบายโปรเจกต์ (`CLAUDE.md`) ห้ามรัน `prisma migrate dev`/`prisma db push` กับฐานข้อมูลนี้
เมื่อต้องแก้ schema ให้แก้ `database/schema.sql` + รัน `ALTER TABLE`/`CREATE TABLE` ตรงกับฐานข้อมูล MariaDB จริงก่อน
แล้วค่อยแก้ `schema.prisma` ให้ตรงกันแล้วรัน `npx prisma generate` เพื่ออัปเดต client type เท่านั้น

ดูต่อ: [ER Diagram](04-er-diagram.md) · [API Design](05-api-design.md)
