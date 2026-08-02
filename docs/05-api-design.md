# 5. API Design (REST)

Base URL: `/api/v1` (ต่อจาก path prefix ของ deployment เช่น `/khd-it-sup/api/v1` — ดู
[docs/07-deployment-guide.md](07-deployment-guide.md)) · รูปแบบ response มาตรฐาน:

```jsonc
// Success
{ "success": true, "data": { ... }, "meta": { "page": 1, "limit": 20, "total": 134 } }

// Error
{ "success": false, "error": { "code": "ASSET_NOT_FOUND", "message": "ไม่พบครุภัณฑ์", "details": [] } }
```

- **Auth header:** `Authorization: Bearer <accessToken>`
- **Full interactive spec (ตรงกับโค้ดจริงเสมอ):** `/api-docs` (Swagger UI สร้างจาก `swagger-jsdoc` annotation เหนือทุก route
  ในโค้ดจริง — เอกสารนี้คือสรุปภาพรวมสำหรับอ่านเร็ว ไม่ใช่แหล่งอ้างอิงหลัก)
- `✅` = implement แล้วและใช้งานได้จริง, `🔜` = Phase 10+ ยังไม่เริ่ม

## 5.1 Auth — `/api/v1/auth` ✅

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| POST | `/auth/login` | public (rate-limited) | เข้าสู่ระบบ (username/password) → accessToken + refreshToken (httpOnly cookie) |
| POST | `/auth/refresh` | public (ต้องมี refresh cookie) | ขอ accessToken ใหม่ + rotate refresh token |
| POST | `/auth/logout` | authenticated | revoke refresh token ปัจจุบัน |
| GET | `/auth/me` | authenticated | ข้อมูลผู้ใช้ปัจจุบัน + permission ทั้งหมด (payload เดียวกับที่ decode จาก JWT) |
| POST | `/auth/change-password` | authenticated | เปลี่ยนรหัสผ่านตนเอง (revoke ทุก session หลังเปลี่ยนสำเร็จ) |
| POST | `/auth/forgot-password` | public (rate-limited) | ขอลิงก์ตั้งรหัสผ่านใหม่ทางอีเมล — ตอบสำเร็จเสมอไม่ว่าจะพบบัญชีหรือไม่ (กัน enumeration) token หมดอายุ 30 นาที ใช้ได้ครั้งเดียว |
| POST | `/auth/reset-password` | public (rate-limited) | ตั้งรหัสผ่านใหม่ด้วย token จากอีเมล — revoke ทุก session หลังสำเร็จ |
| GET | `/auth/notification-channels` | authenticated | ช่องทางแจ้งเตือนส่วนตัว (Telegram Chat ID / LINE User ID) ของตนเอง |
| PATCH | `/auth/notification-channels` | authenticated | ตั้งค่าช่องทางแจ้งเตือนส่วนตัวของตนเอง |
| PATCH | `/auth/profile` | authenticated | ตั้งค่าเพศของตนเอง (เลือกภาพ avatar เริ่มต้น) |
| POST | `/auth/avatar` | authenticated | อัปโหลดรูปโปรไฟล์ของตนเอง (`multipart/form-data`, field `avatar`, รูปภาพเท่านั้น ≤ 2 MB) |
| DELETE | `/auth/avatar` | authenticated | ลบรูปโปรไฟล์ของตนเอง (กลับไปใช้ avatar เริ่มต้นตามเพศ) |

## 5.2 Users — `/api/v1/users` ✅

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/users` | `user:read` | รายชื่อผู้ใช้ (pagination, filter by role/department/keyword) |
| GET | `/users/roles` | authenticated | รายชื่อ role ทั้งหมด (เติม dropdown) |
| GET | `/users/stats` | `user:read` | สรุปสถิติผู้ใช้งาน (ทั้งหมด/ใช้งานอยู่/ปิดใช้งาน/ต้องเปลี่ยนรหัสผ่าน) + แจกแจงตาม role/หน่วยงาน |
| GET | `/users/technicians` | `ticket:assign` | รายชื่อช่างเทคนิค/เจ้าหน้าที่ไอทีที่ใช้งานอยู่ (เติม dropdown ตอนมอบหมายงาน) |
| GET | `/users/:id` | `user:read` | รายละเอียดผู้ใช้ |
| POST | `/users` | `user:create` | สร้างผู้ใช้ (รับฟิลด์ `gender` ด้วย, บังคับเปลี่ยนรหัสผ่านครั้งแรกเสมอ) |
| PATCH | `/users/:id` | `user:update` | แก้ไขผู้ใช้ |
| DELETE | `/users/:id` | `user:delete` | ลบผู้ใช้ (soft delete) |
| POST | `/users/:id/reset-password` | `user:reset_password` | รีเซ็ตรหัสผ่าน (สุ่มรหัสชั่วคราว ส่งอีเมลอัตโนมัติ + บังคับเปลี่ยน) |
| POST | `/users/:id/avatar` | `user:update` | อัปโหลดรูปโปรไฟล์ให้ผู้ใช้คนอื่น (`multipart/form-data`, field `avatar`) |
| DELETE | `/users/:id/avatar` | `user:update` | ลบรูปโปรไฟล์ของผู้ใช้คนอื่น |

## 5.3 Departments / Divisions / Positions ✅

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/departments` | authenticated | รายชื่อหน่วยงานทั้งหมด |
| GET | `/departments/:id` | authenticated | รายละเอียดหน่วยงาน |
| POST/PATCH/DELETE | `/departments`, `/departments/:id` | `department:manage` | สร้าง/แก้ไข/ปิดใช้งานหน่วยงาน |
| GET | `/divisions` | authenticated | รายชื่อแผนกทั้งหมด (เติม dropdown) |
| GET | `/divisions/:id` | authenticated | รายละเอียดแผนก |
| POST/PATCH/DELETE | `/divisions`, `/divisions/:id` | `department:manage` | สร้าง/แก้ไข/ปิดใช้งานแผนก |
| GET | `/positions` | authenticated | รายชื่อตำแหน่งงานทั้งหมด (เติม dropdown) |
| GET | `/positions/:id` | authenticated | รายละเอียดตำแหน่งงาน |
| POST/PATCH/DELETE | `/positions`, `/positions/:id` | `user:create`/`user:update` | สร้าง/แก้ไข/ปิดใช้งานตำแหน่งงาน |

## 5.4 Locations (อาคาร/ชั้น/ห้อง) — mount ที่ root `/api/v1` ✅

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/buildings`, `/floors`, `/rooms` | authenticated | รายชื่ออาคาร/ชั้น/ห้องทั้งหมด (`floors`/`rooms` กรองตาม parent ผ่าน query ได้) |
| POST/PATCH/DELETE | เหมือนกัน | `asset:create`/`asset:update`/`asset:delete` | จัดการอาคาร/ชั้น/ห้อง (ใช้ผูกตำแหน่งครุภัณฑ์) |

## 5.5 Assets — `/api/v1/assets` ✅

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/assets/categories` | authenticated | รายการประเภทครุภัณฑ์ทั้งหมด (14 ประเภท) |
| POST/PATCH/DELETE | `/assets/categories`, `/assets/categories/:id` | `asset:create`/`asset:update` | จัดการประเภทครุภัณฑ์ |
| GET | `/assets` | `asset:read` | รายการครุภัณฑ์ (filter: category, department, status, keyword — ใช้ FULLTEXT) |
| GET | `/assets/:id` | `asset:read` | รายละเอียดครุภัณฑ์ |
| GET | `/assets/:id/history` | `asset:view_history` | ประวัติการซ่อมของครุภัณฑ์นี้ |
| POST | `/assets` | `asset:create` | สร้างครุภัณฑ์ (auto-generate `asset_number` จาก `running_number_sequences`) |
| PATCH | `/assets/:id` | `asset:update` | แก้ไขครุภัณฑ์ |
| DELETE | `/assets/:id` | `asset:delete` | ลบครุภัณฑ์ (soft delete) |
| POST | `/assets/:id/photos` | `asset:update` | อัปโหลดรูปครุภัณฑ์ (`multipart/form-data`, field `photos`, สูงสุด 10 ไฟล์) |
| DELETE | `/assets/:id/photos/:photoId` | `asset:update` | ลบรูปครุภัณฑ์ |

## 5.6 Asset Loans (ยืม-คืนครุภัณฑ์) — `/api/v1/asset-loans` ✅

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/asset-loans` | authenticated | รายการยืม-คืน (filter: status BORROWED/OVERDUE/RETURNED, keyword) |
| GET | `/asset-loans/stats` | authenticated | สรุปจำนวน (ทั้งหมด/กำลังยืม/เกินกำหนด/คืนแล้ว) |
| GET | `/asset-loans/chart` | authenticated | ข้อมูลกราฟ (ครุภัณฑ์/ผู้ยืมที่ถูกยืมบ่อยที่สุด) |
| GET | `/asset-loans/:id` | authenticated | รายละเอียดรายการยืม-คืน |
| POST | `/asset-loans` | `asset:loan` | บันทึกยืมครุภัณฑ์ (แจ้งเตือนผู้ยืมทุกช่องทางทันที) |
| PATCH | `/asset-loans/:id` | `asset:loan` | แก้ไขรายการยืม-คืน |
| DELETE | `/asset-loans/:id` | `asset:loan` | ลบรายการยืม-คืน |
| POST | `/asset-loans/:id/return` | `asset:loan` | บันทึกคืนครุภัณฑ์ (แจ้งเตือนผู้ยืมทุกช่องทาง) |

> รายการที่เกินกำหนดคืน (`expected_return_date` ผ่านไปแล้วและยังไม่คืน) ถูกแจ้งเตือนซ้ำอัตโนมัติทุกวันเวลา 08:00
> (Asia/Bangkok) ผ่าน cron job ภายใน backend — ดู § 5.8

## 5.7 QR Code — `/api/v1/qrcodes` ✅

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| POST | `/qrcodes/assets/:assetId/generate` | `qrcode:generate` | สร้าง/สร้างใหม่ QR (encrypt asset id ด้วย AES → `qr_token`, regenerate ทำให้สติกเกอร์เดิมใช้ไม่ได้) |
| GET | `/qrcodes/assets/:assetId/print` | `qrcode:print` | คืนรูป QR เป็น PNG ความละเอียดสูงสำหรับพิมพ์ติดสติกเกอร์ |
| POST | `/qrcodes/bulk-print` | `qrcode:print` | สร้าง QR หลายรายการพร้อมกัน (array of assetId) |
| GET | `/qrcodes/resolve/:token` | **public** (optional auth) | ถอดรหัส token → คืนข้อมูลครุภัณฑ์แบบย่อ สำหรับหน้า scan |

## 5.8 Repair Tickets — `/api/v1/repair-tickets` ✅

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/repair-tickets` | `ticket:read` / `ticket:track` (เห็นเฉพาะของตน) | รายการใบแจ้งซ่อม (filter: status, urgency, department, technician, date range) |
| GET | `/repair-tickets/:id` | `ticket:read` / `ticket:track` | รายละเอียด + progress ของ workflow ปัจจุบัน |
| GET | `/repair-tickets/:id/timeline` | `ticket:read` / `ticket:track` | Timeline แบบ immutable ทั้งหมด เรียงตามเวลา |
| POST | `/repair-tickets` | `ticket:create` | สร้างใบแจ้งซ่อมใหม่ (auto-generate เลขที่ + เริ่ม workflow instance) |
| POST | `/repair-tickets/:id/receive` | `ticket:receive` | IT Officer รับเรื่อง (SUBMITTED → RECEIVED) |
| POST | `/repair-tickets/:id/assign` | `ticket:assign` | มอบหมายช่างผู้รับผิดชอบ (ไม่เปลี่ยนสถานะ workflow) |
| POST | `/repair-tickets/:id/transition` | `ticket:update_status` | เปลี่ยนสถานะตาม `workflow_transitions` ที่อนุญาต (ไม่รวม close/cancel) |
| PATCH | `/repair-tickets/:id/summary` | `ticket:update_status` | บันทึก/แก้ไขสรุปผลการซ่อม (สาเหตุ/วิธีแก้/อะไหล่/ข้อเสนอแนะ) |
| POST | `/repair-tickets/:id/approve-unit-head` | `ticket:approve` | หัวหน้างานของผู้แจ้งลงนามรับทราบ (ส่วนที่ 1 ของแบบฟอร์ม) |
| POST | `/repair-tickets/:id/inspection` | `ticket:update_status` | บันทึกผลตรวจสอบเบื้องต้นโดยเจ้าหน้าที่ไอที (ส่วนที่ 2) |
| POST | `/repair-tickets/:id/approve-digital-health-head` | `ticket:approve` | หัวหน้ากลุ่มงานสุขภาพดิจิทัลลงนามรับรอง (ส่วนที่ 2) |
| POST | `/repair-tickets/:id/cancel` | `ticket:cancel` | ยกเลิกใบแจ้งซ่อม (ต้องระบุเหตุผล) |
| POST | `/repair-tickets/:id/close` | `ticket:close` | ปิดงาน (จาก step USER_ACCEPTANCE เท่านั้น) |
| POST | `/repair-tickets/:id/comment` | authenticated | เพิ่มความคิดเห็นลง Timeline โดยไม่เปลี่ยนสถานะ |
| POST | `/repair-tickets/:id/attachments` | `ticket:upload_attachment` | อัปโหลดรูป/วิดีโอแนบ (`multipart/form-data`, field `attachments`, สูงสุด 5 ไฟล์ ไฟล์ละ ≤ 5 MB) |

## 5.9 Workflow (read-only ใน MVP, config เต็มรูปแบบ 🔜 Phase 10+)

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/workflow-templates/:code` | authenticated | โครงสร้างผังงาน (steps + transitions) เพื่อ render ใน UI Timeline (เช่น `REPAIR_INTERNAL`) |
| PATCH | `/workflow-templates/:id/steps` 🔜 | `workflow:configure` | แก้ไข step/SLA/role ผู้รับผิดชอบ |
| POST | `/workflow-templates/:id/flow-designer` 🔜 | `workflow:configure` | บันทึกผังจาก Visual Flow Designer (drag & drop) |

> ปัจจุบัน seed ไว้เฉพาะ `REPAIR_INTERNAL` (12 ขั้นตอน) — ยังไม่มี workflow template สำหรับซ่อมภายนอก
> (`REPAIR_EXTERNAL`) แม้ enum `applies_to` ใน schema จะรองรับอยู่แล้วก็ตาม

## 5.10 Notifications — `/api/v1/notifications` ✅

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/notifications/logs` | `audit:view` หรือ `settings:manage` | ประวัติการแจ้งเตือนทุกช่องทาง (Email/Telegram/LINE/Push) ใช้ตรวจสอบสถานะการส่ง |
| GET | `/notifications/me` | authenticated | แจ้งเตือนในแอป (bell) ของตนเอง (channel="PUSH" เฉพาะของ userId ตนเอง) |
| GET | `/notifications/me/unread-count` | authenticated | จำนวนแจ้งเตือนในแอปที่ยังไม่อ่าน |
| PATCH | `/notifications/me/:id/read` | authenticated | อ่านแจ้งเตือนในแอปรายการเดียว |
| PATCH | `/notifications/me/read-all` | authenticated | อ่านแจ้งเตือนในแอปทั้งหมด |

`NotificationService` ถูกเรียกจาก `RepairTicketService`/`AssetLoanService`/cron job โดยตรง ไม่มี public endpoint สำหรับ
"ส่งแจ้งเตือน" ตรง ๆ — ทุกครั้งที่ส่งจะ (1) บันทึกลง `notification_logs` เสมอไม่ว่าสำเร็จหรือไม่ และ (2) ถ้าเป็นเหตุการณ์ที่ผูก
กับผู้ใช้รายคน จะยิง Socket.IO event `notification:new` แบบ realtime ไปยังห้อง `user:<userId>` ด้วย (ดู § 5.13)

## 5.11 Dashboard — `/api/v1/dashboard` ✅

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/dashboard/summary` | `dashboard:view` | การ์ดสรุป (pending, completed, waiting parts, cancelled) + สถานะครุภัณฑ์ |
| GET | `/dashboard/charts/monthly` | `dashboard:view` | ข้อมูลกราฟรายเดือนของปีที่ระบุ |
| GET | `/dashboard/charts/yearly` | `dashboard:view` | ข้อมูลกราฟรายปีทั้งหมด |
| GET | `/dashboard/charts/department-ranking` | `dashboard:view` | อันดับหน่วยงานที่แจ้งซ่อมมากที่สุด |
| GET | `/dashboard/charts/technician-workload` | `dashboard:view` | ภาระงานช่างแต่ละคน (เฉพาะงานที่ยังไม่ปิด) |
| GET | `/dashboard/analytics` | `dashboard:view` | เวลาซ่อมเฉลี่ย + Top ครุภัณฑ์ที่ถูกแจ้งซ่อมบ่อยที่สุด |

## 5.12 Settings — `/api/v1/settings` ✅ (แจ้งเตือน) / 🔜 (ทั่วไป)

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/settings/notifications` | `settings:manage` หรือ `audit:view` | ค่าตั้งค่าการแจ้งเตือน (เปิด/ปิดช่องทาง, Telegram/LINE credential (ไม่คืนค่าจริง), เหตุการณ์แต่ละประเภท) |
| PATCH | `/settings/notifications` | `settings:manage` | แก้ไขค่าตั้งค่าการแจ้งเตือน — เก็บแบบ key-value ใน `system_settings` (category="notification") |
| GET/PATCH | `/settings/organization`, `/settings/theme` 🔜 | `settings:manage` | ตั้งค่าองค์กร/ธีมทั่วไป — ปัจจุบันกำหนดผ่าน `.env` เท่านั้น |

## 5.13 Realtime — Socket.IO (ไม่ใช่ REST) ✅

| Path | คำอธิบาย |
|---|---|
| `/socket.io/` (namespace เดียว) | Client เชื่อมต่อหลัง login ด้วย JWT access token ผ่าน `auth: { token }` ตอน connect (ดู `infrastructure/socket/socket.server.ts`) แต่ละ client จะถูกจับเข้าห้อง `user:<userId>` อัตโนมัติ |
| Event `notification:new` (server → client) | ยิงเมื่อมีแจ้งเตือนในแอปใหม่สำหรับ user นั้น — payload: `{ id, title, message, relatedEntityType, relatedEntityId, createdAt }` |

> **Path prefix gotcha:** เมื่อ deploy ใต้ path prefix (เช่น `/khd-it-sup/`) ต้องกำหนด `path` option ของ
> socket.io-client ให้รวม prefix เข้าไปด้วยตรง ๆ (เช่น `/khd-it-sup/socket.io`) — การส่ง prefix ผ่าน connection URL
> เฉย ๆ ไม่ทำให้ client ต่อ path ที่ถูกต้อง (ดู `frontend/src/app/core/services/socket.service.ts`)

## 5.14 Audit Log — `/api/v1/audit-logs` ✅

| Method | Path | Permission |
|---|---|---|
| GET | `/audit-logs` | `audit:view` |

รองรับ query filter: `module`, `action` (`LOGIN`/`LOGOUT`/`CREATE`/`UPDATE`/`DELETE`/`PRINT`/`EXPORT`/`APPROVE`/`CONFIG_CHANGE`),
`userId`, `dateFrom`, `dateTo`, `page`, `limit` — ผลลัพธ์รวม `user` (id/fullName/username) ของผู้กระทำ เรียงล่าสุดก่อนเสมอ
(ตาราง `audit_logs` เป็น insert-only ledger บังคับด้วย MariaDB trigger)

---

## 5.15 ตัวอย่าง OpenAPI 3.0 (Auth module) — รูปแบบที่ swagger-jsdoc generate จริงจาก JSDoc comment เหนือแต่ละ route

```yaml
openapi: 3.0.3
info:
  title: KHD-IT-SUP API
  version: 1.0.0
  description: IT Service Desk & Asset Maintenance Management System — สำนักงานสาธารณสุขจังหวัดนครราชสีมา
servers:
  - url: /khd-it-sup/api/v1
paths:
  /auth/login:
    post:
      tags: [Auth]
      summary: เข้าสู่ระบบ
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [username, password]
              properties:
                username: { type: string, example: admin }
                password: { type: string, format: password, example: Admin@12345 }
      responses:
        '200':
          description: เข้าสู่ระบบสำเร็จ
          content:
            application/json:
              schema:
                type: object
                properties:
                  success: { type: boolean }
                  data:
                    type: object
                    properties:
                      accessToken: { type: string }
                      user: { $ref: '#/components/schemas/UserProfile' }
        '401':
          description: ข้อมูลเข้าสู่ระบบไม่ถูกต้อง
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    UserProfile:
      type: object
      properties:
        id: { type: string, format: uuid }
        username: { type: string }
        fullName: { type: string }
        role: { type: string, example: SUPER_ADMIN }
        avatarUrl: { type: string, nullable: true }
        gender: { type: string, enum: [MALE, FEMALE], nullable: true }
        permissions:
          type: array
          items: { type: string }
security:
  - bearerAuth: []
```

โครงนี้ถูกประกอบอัตโนมัติจาก JSDoc `@openapi` annotation ในทุกไฟล์ `*/routes.ts` โดยใช้ `swagger-jsdoc` +
`swagger-ui-express` mount ที่ `/api-docs` — เปิดดู endpoint ทั้งหมดพร้อมทดลองยิงได้จริงที่นั่น
