# 5. API Design (REST)

Base URL: `/api/v1` · รูปแบบ response มาตรฐาน:

```jsonc
// Success
{ "success": true, "data": { ... }, "meta": { "page": 1, "limit": 20, "total": 134 } }

// Error
{ "success": false, "error": { "code": "ASSET_NOT_FOUND", "message": "ไม่พบครุภัณฑ์", "details": [] } }
```

- **Auth header:** `Authorization: Bearer <accessToken>`
- **Full interactive spec:** เมื่อ Backend Phase 1 เสร็จ จะให้บริการที่ `/api-docs` (Swagger UI สร้างจาก `swagger-jsdoc`
  annotations ในโค้ดจริงทุก endpoint — ไม่ maintain แยกจากโค้ด เพื่อไม่ให้เอกสารเพี้ยนจากของจริง)
- เอกสารนี้คือ **endpoint inventory** ระดับออกแบบ ก่อนลงมือเขียนโค้ด Phase 1 เป็นต้นไป (`✅` = อยู่ใน MVP Phase 1-9, `🔜` = Phase 10+)

## 5.1 Auth — `/api/v1/auth` ✅

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| POST | `/auth/login` | public | เข้าสู่ระบบ (username/password) → accessToken + refreshToken (httpOnly cookie) |
| POST | `/auth/refresh` | public (ต้องมี refresh cookie) | ขอ accessToken ใหม่ + rotate refresh token |
| POST | `/auth/logout` | authenticated | revoke refresh token ปัจจุบัน |
| GET  | `/auth/me` | authenticated | ข้อมูลผู้ใช้ปัจจุบัน + permission ทั้งหมด |
| POST | `/auth/change-password` | authenticated | เปลี่ยนรหัสผ่านตนเอง |

## 5.2 Users — `/api/v1/users` ✅

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/users` | `user:read` | รายชื่อผู้ใช้ (pagination, filter by role/department) |
| GET | `/users/:id` | `user:read` | รายละเอียดผู้ใช้ |
| POST | `/users` | `user:create` | สร้างผู้ใช้ |
| PATCH | `/users/:id` | `user:update` | แก้ไขผู้ใช้ |
| DELETE | `/users/:id` | `user:delete` | ลบผู้ใช้ (soft delete) |
| POST | `/users/:id/reset-password` | `user:reset_password` | รีเซ็ตรหัสผ่าน (สุ่มรหัสชั่วคราว + บังคับเปลี่ยน) |
| GET | `/users/roles` | authenticated | รายชื่อ role ทั้งหมด (เติม dropdown ตอนสร้าง/แก้ไขผู้ใช้) |
| GET | `/users/stats` | `user:read` | สรุปสถิติผู้ใช้งาน (ทั้งหมด/ใช้งานอยู่/ปิดใช้งาน/ต้องเปลี่ยนรหัสผ่าน) + แจกแจงตาม role/หน่วยงาน |
| GET | `/users/technicians` | `ticket:assign` | รายชื่อช่างเทคนิค/เจ้าหน้าที่ไอทีที่ใช้งานอยู่ (เติม dropdown ตอนมอบหมายงาน) |
| POST | `/users/:id/avatar` 🔜 | authenticated (self) หรือ `user:update` | อัปโหลด avatar (Multer uploader พร้อมใช้งานที่ระดับ infra แล้ว แต่ยังไม่ได้ผูก route/controller — Phase 10+) |

## 5.3 Departments — `/api/v1/departments` ✅

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/departments` | authenticated | รายชื่อหน่วยงาน (tree) |
| POST | `/departments` | `department:manage` | สร้างหน่วยงาน |
| PATCH | `/departments/:id` | `department:manage` | แก้ไขหน่วยงาน |
| DELETE | `/departments/:id` | `department:manage` | ลบหน่วยงาน |

## 5.4 Assets — `/api/v1/assets` ✅

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/assets` | `asset:read` | รายการครุภัณฑ์ (filter: category, department, status, keyword — ใช้ FULLTEXT) |
| GET | `/assets/:id` | `asset:read` | รายละเอียดครุภัณฑ์ |
| GET | `/assets/:id/history` | `asset:view_history` | ประวัติ (repair tickets ที่ผูกกับครุภัณฑ์นี้) |
| POST | `/assets` | `asset:create` | สร้างครุภัณฑ์ (auto-generate `asset_number` จาก `running_number_sequences`) |
| PATCH | `/assets/:id` | `asset:update` | แก้ไขครุภัณฑ์ |
| DELETE | `/assets/:id` | `asset:delete` | ลบครุภัณฑ์ (soft delete) |
| POST | `/assets/:id/photos` | `asset:update` | อัปโหลดรูปครุภัณฑ์ (Multer, multi-file) |
| GET | `/assets/categories` | authenticated | รายการประเภทครุภัณฑ์ (14 ประเภท) |

## 5.5 QR Code — `/api/v1/qrcodes` ✅

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| POST | `/qrcodes/assets/:assetId/generate` | `qrcode:generate` | สร้าง/สร้างใหม่ QR (encrypt asset id ด้วย AES → `qr_token`) |
| GET | `/qrcodes/assets/:assetId/print` | `qrcode:print` | คืนรูป QR เป็น PNG ความละเอียดสูงสำหรับพิมพ์ติดสติกเกอร์ (เลย์เอาต์ A4/สติกเกอร์แบบมีหัวกระดาษราชการเต็มรูปแบบอยู่ใน Document Printing module — Phase 10+) |
| POST | `/qrcodes/bulk-print` | `qrcode:print` | พิมพ์ QR หลายรายการพร้อมกัน (array of assetId) |
| GET | `/qrcodes/resolve/:token` | **public** | ถอดรหัส token → คืนข้อมูลครุภัณฑ์แบบย่อ สำหรับหน้า scan (ไม่ต้อง login) |

## 5.6 Repair Tickets — `/api/v1/repair-tickets` ✅

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/repair-tickets` | `ticket:read` / `ticket:track` (เห็นเฉพาะของตน) | รายการใบแจ้งซ่อม (filter: status, urgency, department, technician, date range) |
| GET | `/repair-tickets/:id` | `ticket:read` / เจ้าของ ticket | รายละเอียด + workflow ปัจจุบัน + SLA คำนวณสด |
| POST | `/repair-tickets` | `ticket:create` (ต้อง login — QR scan page จะพาผู้ใช้ที่ยังไม่ login ไปหน้า login ก่อนเสมอ ไม่มี guest bypass) | สร้างใบแจ้งซ่อมใหม่ → auto-init workflow instance + timeline event แรก |
| POST | `/repair-tickets/:id/receive` | `ticket:receive` | IT Officer รับเรื่อง → เปลี่ยน step เป็น RECEIVED |
| POST | `/repair-tickets/:id/assign` | `ticket:assign` | มอบหมายช่างเทคนิค → step IT_REVIEW/DIAGNOSIS |
| POST | `/repair-tickets/:id/transition` | `ticket:update_status` | เปลี่ยน step ตาม `workflow_transitions` ที่อนุญาตจาก step ปัจจุบัน |
| POST | `/repair-tickets/:id/attachments` | `ticket:upload_attachment` | อัปโหลดรูป/ไฟล์แนบ (before/after) |
| POST | `/repair-tickets/:id/cancel` | `ticket:cancel` | ยกเลิกใบแจ้งซ่อม (ต้องระบุเหตุผล) |
| POST | `/repair-tickets/:id/close` | `ticket:close` | ปิดงาน (step CLOSED, terminal) |
| GET | `/repair-tickets/:id/timeline` | `ticket:read` / เจ้าของ ticket | Timeline เต็มรูปแบบ (immutable event ทั้งหมด เรียงเวลา) |

## 5.7 Workflow (read-only ใน MVP, config เต็มรูปแบบ 🔜 Phase 10+)

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/workflow-templates/:code` | authenticated | โครงสร้างผังงาน (steps + transitions) เพื่อ render ใน UI Timeline |
| PATCH | `/workflow-templates/:id/steps` 🔜 | `workflow:configure` | แก้ไข step/SLA/role ผู้รับผิดชอบ |
| POST | `/workflow-templates/:id/flow-designer` 🔜 | `workflow:configure` | บันทึกผังจาก Visual Flow Designer (drag & drop) |

## 5.8 Notifications ✅ (Email) / 🔜 (Telegram, LINE)

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/notifications/logs` | `audit:view` หรือ `settings:manage` | ประวัติการแจ้งเตือนทุกช่องทาง (ใช้ตรวจสอบ delivery) |
| (internal) | — | — | `NotificationService` ถูกเรียกจาก `RepairTicketService`/`WorkflowService` โดยตรง ไม่มี public endpoint สำหรับ "ส่งแจ้งเตือน" ตรง ๆ |

## 5.9 Dashboard — `/api/v1/dashboard` ✅

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/dashboard/summary` | `dashboard:view` | การ์ดสรุป (pending, completed, waiting parts, cancelled) + สถานะครุภัณฑ์ |
| GET | `/dashboard/charts/monthly` | `dashboard:view` | ข้อมูลกราฟรายเดือนของปีที่ระบุ |
| GET | `/dashboard/charts/yearly` | `dashboard:view` | ข้อมูลกราฟรายปีทั้งหมด |
| GET | `/dashboard/charts/department-ranking` | `dashboard:view` | อันดับหน่วยงานที่แจ้งซ่อมมากที่สุด |
| GET | `/dashboard/charts/technician-workload` | `dashboard:view` | ภาระงานช่างแต่ละคน (เฉพาะงานที่ยังไม่ปิด) |
| GET | `/dashboard/analytics` | `dashboard:view` | เวลาซ่อมเฉลี่ย + Top 10 ครุภัณฑ์ที่ถูกแจ้งซ่อมบ่อยที่สุด |

## 5.10 Audit Log 🔜 Phase 10+

| Method | Path | Permission |
|---|---|---|
| GET | `/audit-logs` | `audit:view` |

## 5.11 Settings 🔜 Phase 10+ (backend infra สำหรับ SMTP มีตั้งแต่ Phase 4)

| Method | Path | Permission |
|---|---|---|
| GET/PATCH | `/settings/smtp`, `/settings/telegram`, `/settings/line`, `/settings/organization` | `settings:manage` |

---

## 5.12 ตัวอย่าง OpenAPI 3.0 (Auth module) — รูปแบบที่ swagger-jsdoc จะ generate จริงจาก JSDoc comment เหนือแต่ละ route

```yaml
openapi: 3.0.3
info:
  title: KHD-IT-SUP API
  version: 1.0.0
  description: IT Service Desk & Asset Maintenance Management System — สำนักงานสาธารณสุขจังหวัดนครราชสีมา
servers:
  - url: /api/v1
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
        permissions:
          type: array
          items: { type: string }
security:
  - bearerAuth: []
```

โครงนี้จะถูกประกอบอัตโนมัติจาก JSDoc annotation ในทุกไฟล์ `*.routes.ts` เมื่อ implement Backend จริง (Phase 1 เป็นต้นไป)
โดยใช้ `swagger-jsdoc` + `swagger-ui-express` mount ที่ `/api-docs`
