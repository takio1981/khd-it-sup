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
| GET | `/users/export?format=xlsx\|csv` | `user:read` | Export รายชื่อผู้ใช้ (ใช้ filter เดียวกับ `/users`, สูงสุด 5,000 แถว) |

## 5.3 Departments / Divisions / Positions ✅

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/departments` | authenticated | รายชื่อหน่วยงานทั้งหมด |
| GET | `/departments/:id` | authenticated | รายละเอียดหน่วยงาน |
| POST/PATCH/DELETE | `/departments`, `/departments/:id` | `department:manage` | สร้าง/แก้ไข/ปิดใช้งานหน่วยงาน |
| GET | `/departments/export?format=xlsx\|csv` | authenticated | Export รายชื่อหน่วยงานทั้งหมด |
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
| GET | `/assets/export?format=xlsx\|csv` | `asset:read` | Export รายการครุภัณฑ์ (ใช้ filter เดียวกับ `/assets`, สูงสุด 5,000 แถว) |

## 5.6 Asset Loans (ยืม-คืนครุภัณฑ์) — `/api/v1/asset-loans` ✅

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/asset-loans` | `asset:loan` | รายการยืม-คืนทั้งหมดทุกคน (filter: status BORROWED/OVERDUE/RETURNED, keyword) |
| GET | `/asset-loans/stats` | `asset:loan` | สรุปจำนวน (ทั้งหมด/กำลังยืม/เกินกำหนด/คืนแล้ว) |
| GET | `/asset-loans/chart` | `asset:loan` | ข้อมูลกราฟ (ครุภัณฑ์/ผู้ยืมที่ถูกยืมบ่อยที่สุด) |
| GET | `/asset-loans/:id` | `asset:loan` | รายละเอียดรายการยืม-คืน |
| POST | `/asset-loans` | `asset:loan` **หรือ** `asset:loan_self` | บันทึกยืมครุภัณฑ์ (แจ้งเตือนผู้ยืม + เจ้าหน้าที่ไอทีทุกคนทุกช่องทาง) — ผู้มีแค่ `asset:loan_self` ระบุ `borrowerId` เป็นใครก็ได้ไม่ได้ ต้องเป็นตัวเองเท่านั้น (บังคับที่ service layer, ไม่งั้น `403 FORBIDDEN`) |
| PATCH | `/asset-loans/:id` | `asset:loan` | แก้ไขรายการยืม-คืน |
| DELETE | `/asset-loans/:id` | `asset:loan` | ลบรายการยืม-คืน |
| POST | `/asset-loans/:id/return` | `asset:loan` **หรือ** `asset:loan_self` | บันทึกคืนครุภัณฑ์ (แจ้งเตือนผู้ยืม + เจ้าหน้าที่ไอทีทุกช่องทาง) — ผู้มีแค่ `asset:loan_self` คืนได้เฉพาะรายการที่ตัวเองเป็นผู้ยืมเท่านั้น |
| GET | `/asset-loans/export?format=xlsx\|csv` | `asset:loan` | Export รายการยืม-คืน (ใช้ filter เดียวกับ `/asset-loans`, สูงสุด 5,000 แถว) |

> รายการที่เกินกำหนดคืน (`expected_return_date` ผ่านไปแล้วและยังไม่คืน) ถูกแจ้งเตือนซ้ำอัตโนมัติทุกวันเวลา 08:00
> (Asia/Bangkok) ผ่าน cron job ภายใน backend — ดู § 5.8
>
> **`asset:loan_self` (self-service ผ่านสแกน QR)**: role `USER` มีสิทธิ์นี้ (ไม่มี `asset:loan` เต็ม) ให้พนักงานทุกคนยืม-คืน
> อุปกรณ์ของตัวเองได้เองผ่านหน้า `/qr/scan/:token` โดยไม่เห็น/แก้ไข/ลบรายการของผู้อื่น และเข้า `GET /asset-loans` (รายการเต็ม)
> ไม่ได้ — เมนู "ยืมครุภัณฑ์-อุปกรณ์" ในแถบเมนูยังคงอิง `asset:loan` เดิมเท่านั้น ไม่แสดงให้ role `USER` เห็น
>
> **Performance**: การแจ้งเตือน (`notifyAssetLoanEvent`) ไม่ await ก่อนตอบ response (เดิม await ทำให้ endpoint ตอบช้าถึง
> ~10 วินาทีตอนต้องส่งอีเมลหลายฉบับ — วัดได้จริงหลังเพิ่มการแจ้งเตือนเจ้าหน้าที่ไอที) แจ้งเตือนทำงานเป็น fire-and-forget
> เบื้องหลังหลัง response ส่งกลับไปแล้ว (`notifySafe` ดัก error เองอยู่แล้วจึงไม่มีผลต่อความถูกต้องของ response)

## 5.7 QR Code — `/api/v1/qrcodes` ✅

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| POST | `/qrcodes/assets/:assetId/generate` | `qrcode:generate` | สร้าง/สร้างใหม่ QR (encrypt asset id ด้วย AES → `qr_token`, regenerate ทำให้สติกเกอร์เดิมใช้ไม่ได้) |
| GET | `/qrcodes/assets/:assetId/print` | `qrcode:print` | คืนรูป QR เป็น PNG ความละเอียดสูงสำหรับพิมพ์ติดสติกเกอร์ |
| POST | `/qrcodes/bulk-print` | `qrcode:print` | สร้าง QR หลายรายการพร้อมกัน (array of assetId) |
| GET | `/qrcodes/resolve/:token` | **public** (optional auth) | ถอดรหัส token → คืนข้อมูลครุภัณฑ์แบบย่อ สำหรับหน้า scan (รวม `activeLoan` — รายการยืมปัจจุบันที่ยังไม่คืน ถ้ามี, และ `photos` — รูปครุภัณฑ์ทั้งหมดที่บันทึกไว้ สูงสุด 8 รูป) |

> **หน้า `/qr/scan/:token`** (frontend, public landing page — ไม่ต้อง login เพื่อดูข้อมูลเครื่องและเลือกการกระทำ):
> แสดงข้อมูลครุภัณฑ์ + รูปภาพครุภัณฑ์ทั้งหมด (คลิกดูขยายได้) + ประวัติแจ้งซ่อมล่าสุด พร้อมปุ่ม "แจ้งซ่อมครุภัณฑ์นี้"
> (`POST /repair-tickets`, แนบรูปเครื่อง/อาการเสียได้สูงสุด 3 ภาพในคำขอเดียวกัน) และ "ยืม/คืนอุปกรณ์นี้" (`POST
> /asset-loans` หรือ `POST /asset-loans/:id/return` แล้วแต่ `activeLoan` ของครุภัณฑ์นั้น — ปุ่มสลับป้ายกำกับอัตโนมัติ
> เป็น "ยืม" หรือ "คืน" ตามว่าเครื่องว่างอยู่หรือมีคนยืมอยู่แล้ว โดยยังไม่ต้องรู้ว่าใครเป็นผู้ยืมก่อน login) **ให้เลือก/
> กรอกฟอร์มได้ก่อนโดยไม่ต้อง login** — ระบบจะถาม username/password ผ่าน dialog เฉพาะตอนกด "บันทึก" เท่านั้น (ไม่
> redirect ไปหน้า login แยกอีกต่อไป) เมื่อ login ผ่าน dialog สำเร็จจะส่งรายการที่กรอกไว้ต่อให้อัตโนมัติ
>
> **รูปครุภัณฑ์ในหน้า scan (public)**: ฝังเป็น base64 data URL ตรงใน response ของ `resolve` เอง (ไม่ใช่ URL ไปที่
> `/files/...` เหมือนหน้า admin ปกติ) เพราะไฟล์แนบทุกชนิดถูก serve ผ่าน endpoint ที่บังคับ authenticate เสมอ — ผู้สแกน
> ที่ยังไม่ login จะโหลดรูปด้วย URL ตรงๆ ไม่ได้ จึงต้องฝังไฟล์มาให้เลยตอน resolve เฉพาะไฟล์รูปภาพ (jpg/png/webp/gif)
> เท่านั้น อ่านไฟล์ไม่สำเร็จจะข้ามรูปนั้นไปเงียบๆ ไม่ทำให้ resolve ทั้งหมด fail
>
> **แนบรูปตอนแจ้งซ่อม**: `POST /repair-tickets` รองรับทั้ง `application/json` แบบเดิม และ `multipart/form-data` (field
> `attachments`, สูงสุด 3 ไฟล์ — รูปภาพเท่านั้น ไม่เกิน 5 MB/ไฟล์) ในคำขอเดียวกัน ไม่ต้องเรียก `POST
> /repair-tickets/:id/attachments` แยกภายหลัง และไม่ต้องมีสิทธิ์ `ticket:upload_attachment` เพิ่มเติม (แนบได้เฉพาะตอน
> สร้างตั๋วของตัวเองเท่านั้น จึงปลอดภัยโดยไม่ต้องขยายสิทธิ์)

## 5.8 Repair Tickets — `/api/v1/repair-tickets` ✅

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/repair-tickets` | `ticket:read` / `ticket:track` (เห็นเฉพาะของตน) | รายการใบแจ้งซ่อม (filter: status, urgency, department, technician, date range) |
| GET | `/repair-tickets/:id` | `ticket:read` / `ticket:track` | รายละเอียด + progress ของ workflow ปัจจุบัน |
| GET | `/repair-tickets/:id/timeline` | `ticket:read` / `ticket:track` | Timeline แบบ immutable ทั้งหมด เรียงตามเวลา |
| POST | `/repair-tickets` | `ticket:create` | สร้างใบแจ้งซ่อมใหม่ (auto-generate เลขที่ + เริ่ม workflow instance) — รองรับแนบรูปเครื่อง/อาการเสียได้พร้อมกันสูงสุด 3 ภาพ (`multipart/form-data`, field `attachments`; ไม่แนบไฟล์ส่งเป็น `application/json` ตามปกติได้เหมือนเดิม) |
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
| GET | `/repair-tickets/export?format=xlsx\|csv` | `ticket:read`/`ticket:track` | Export รายการใบแจ้งซ่อม (ใช้ filter เดียวกับ `/repair-tickets`, สูงสุด 5,000 แถว) |

## 5.9 Workflow (read-only ใน MVP, config เต็มรูปแบบ 🔜 Phase 10+)

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/workflow-templates/:code` | authenticated | โครงสร้างผังงาน (steps + transitions) เพื่อ render ใน UI Timeline (เช่น `REPAIR_INTERNAL`) |
| PATCH | `/workflow-templates/:id/steps` 🔜 | `workflow:configure` | แก้ไข step/SLA/role ผู้รับผิดชอบ |
| POST | `/workflow-templates/:id/flow-designer` 🔜 | `workflow:configure` | บันทึกผังจาก Visual Flow Designer (drag & drop) |

> ปัจจุบัน seed ไว้เฉพาะ `REPAIR_INTERNAL` (14 ขั้นตอน รวม `VENDOR_REPAIR`) — การซ่อมภายนอกเป็น**สาขาแยก (branch)**
> ภายใน template เดียวกัน (DIAGNOSIS → เงื่อนไข `SEND_EXTERNAL` → VENDOR_REPAIR → กลับเข้า TESTING) ไม่ใช่ template
> แยกต่างหาก — enum `applies_to` มีค่า `REPAIR_EXTERNAL` เตรียมไว้ตั้งแต่ Phase 0 แต่ไม่ได้ใช้จริง เพราะสร้าง
> workflow instance แยกต่างหากต่อ template จะซับซ้อนกว่าการแตกสาขาในผังเดียวโดยไม่จำเป็น

## 5.10 Notifications — `/api/v1/notifications` ✅

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/notifications/logs` | `audit:view` หรือ `settings:manage` | ประวัติการแจ้งเตือนทุกช่องทาง (Email/Telegram/LINE/Push) ใช้ตรวจสอบสถานะการส่ง |
| GET | `/notifications/logs/export?format=xlsx\|csv` | `audit:view` หรือ `settings:manage` | Export ประวัติการแจ้งเตือน (ใช้ filter เดียวกับ `/notifications/logs`, สูงสุด 5,000 แถว) |
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
| GET | `/dashboard/export?year=` | `dashboard:view` | Export Excel หลายชีต (สรุป/รายเดือน/อันดับหน่วยงาน) |

## 5.12 Settings — `/api/v1/settings` ✅

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/settings/notifications` | `settings:manage` หรือ `audit:view` | ค่าตั้งค่าการแจ้งเตือน (เปิด/ปิดช่องทาง, Telegram/LINE credential (ไม่คืนค่าจริง), เหตุการณ์แต่ละประเภท) |
| PATCH | `/settings/notifications` | `settings:manage` | แก้ไขค่าตั้งค่าการแจ้งเตือน — เก็บแบบ key-value ใน `system_settings` (category="notification") |
| GET | `/settings/branding` | ผู้ใช้ที่ login แล้วทุกคน | ชื่อองค์กร/โลโก้เท่านั้น (ไม่มี SMTP) — ใช้แสดงใน topbar/sidebar ทุกหน้า |
| GET | `/settings/org` | `settings:manage` หรือ `audit:view` | ค่าตั้งค่าทั่วไปแบบเต็ม (ชื่อองค์กร/โลโก้/ธีมสี/SMTP — `smtpPass` คืนแค่ `smtpPassConfigured: boolean`) |
| PATCH | `/settings/org` | `settings:manage` | แก้ไขค่าตั้งค่าทั่วไป — เก็บใน `system_settings` category `ORGANIZATION`/`THEME`/`SMTP` ที่ seed ไว้ตั้งแต่ Phase 0 มีผลทันทีไม่ต้อง restart (SMTP transporter สร้างใหม่ทุกครั้งที่ส่ง ไม่ cache) |
| POST | `/settings/org/logo` | `settings:manage` | อัปโหลดโลโก้องค์กร (multipart, field `logo`) |
| DELETE | `/settings/org/logo` | `settings:manage` | ลบโลโก้องค์กร (กลับไปใช้ค่า default) |

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
| GET | `/audit-logs/export?format=xlsx\|csv` | `audit:view` |

รองรับ query filter: `module`, `action` (`LOGIN`/`LOGOUT`/`CREATE`/`UPDATE`/`DELETE`/`PRINT`/`EXPORT`/`APPROVE`/`CONFIG_CHANGE`),
`userId`, `dateFrom`, `dateTo`, `page`, `limit` — ผลลัพธ์รวม `user` (id/fullName/username) ของผู้กระทำ เรียงล่าสุดก่อนเสมอ
(ตาราง `audit_logs` เป็น insert-only ledger บังคับด้วย MariaDB trigger) `/export` ใช้ filter เดียวกัน (ยกเว้น page/limit) สูงสุด 5,000 แถว

---

## 5.15 Spare Parts (คลังอะไหล่) — `/api/v1/spare-parts` ✅

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/spare-parts` | `spare_part:view`/`manage`/`issue` | รายการอะไหล่ (filter: keyword, lowStockOnly) |
| POST | `/spare-parts` | `spare_part:manage` | เพิ่มอะไหล่ใหม่ (master data) |
| GET | `/spare-parts/:id` | `spare_part:view`/`manage`/`issue` | รายละเอียดอะไหล่ |
| PATCH | `/spare-parts/:id` | `spare_part:manage` | แก้ไขข้อมูลอะไหล่ (ไม่ใช่การปรับสต็อก) |
| GET | `/spare-parts/transactions` | `spare_part:view`/`manage`/`issue` | ประวัติธุรกรรมทั้งหมด (filter `ticketId` — ใช้แสดงในหน้ารายละเอียดใบแจ้งซ่อม) |
| GET | `/spare-parts/:id/transactions` | `spare_part:view`/`manage`/`issue` | ประวัติธุรกรรมของอะไหล่ชิ้นนี้ |
| POST | `/spare-parts/:id/transactions` | `spare_part:issue`/`manage` | บันทึกธุรกรรม (`RESERVE`/`ISSUE`/`RETURN`/`ADJUST`/`PURCHASE`/`RECEIVE`) |
| GET | `/spare-parts/export?format=xlsx\|csv` | `spare_part:view`/`manage`/`issue` | Export คลังอะไหล่ (ใช้ filter เดียวกับ `/spare-parts`, สูงสุด 5,000 แถว) |

`quantityOnHand` ปรับแบบ atomic ผ่าน `prisma.$transaction` (อ่าน-เขียน-สร้างแถว transaction ในธุรกรรมเดียว) — ถ้าเบิก
(`ISSUE`/`RESERVE`) เกินยอดคงเหลือจะถูกปฏิเสธด้วย `409 CONFLICT` ทันที ไม่มีการเขียนข้อมูลใดๆ เกิดขึ้น `ADJUST` เป็นประเภท
เดียวที่ `quantity` ติดลบได้ (ปรับยอดลง) ประเภทอื่นต้องเป็นค่าบวกเสมอ

---

## 5.16 Vendors (ผู้ขาย/ผู้รับซ่อมภายนอก) — `/api/v1/vendors` ✅

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/vendors` | `vendor:view`/`manage` | รายชื่อผู้ขาย/ผู้รับซ่อมภายนอก (filter: keyword, activeOnly) |
| POST | `/vendors` | `vendor:manage` | เพิ่มผู้ขาย/ผู้รับซ่อมใหม่ |
| GET | `/vendors/:id` | `vendor:view`/`manage` | รายละเอียด |
| PATCH | `/vendors/:id` | `vendor:manage` | แก้ไขข้อมูล/เปิด-ปิดใช้งาน |
| GET | `/vendors/export?format=xlsx\|csv` | `vendor:view`/`manage` | Export รายชื่อผู้ขาย/ผู้รับซ่อมภายนอก (ใช้ filter เดียวกับ `/vendors`, สูงสุด 5,000 แถว) |

## 5.17 Vendor Repair Orders (ใบส่งซ่อมภายนอก) — `/api/v1/vendor-repair-orders` ✅

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/vendor-repair-orders` | `vendor:view`/`manage` | รายการใบส่งซ่อม (filter: ticketId, vendorId, status) |
| POST | `/vendor-repair-orders` | `vendor:manage` | เปิดใบส่งซ่อมใหม่ (ticketId+vendorId) — ใช้เมื่อตั๋วอยู่ที่สถานะ `VENDOR_REPAIR` แล้วเท่านั้น |
| GET | `/vendor-repair-orders/:id` | `vendor:view`/`manage` | รายละเอียด |
| PATCH | `/vendor-repair-orders/:id` | `vendor:manage` | แก้ไขสถานะ/ข้อมูล (`QUOTATION_REQUESTED→...→COMPLETED`/`CANCELLED`) |
| POST | `/vendor-repair-orders/:id/quotation-file` | `vendor:manage` | อัปโหลดไฟล์ใบเสนอราคา (multipart, field `file`) |
| POST | `/vendor-repair-orders/:id/invoice-file` | `vendor:manage` | อัปโหลดไฟล์ใบแจ้งหนี้/ใบเสร็จ (multipart, field `file`) |

พฤติกรรมพิเศษของ `PATCH /vendor-repair-orders/:id`:
- ตั้ง `status: 'PO_GENERATED'` โดยยังไม่มี `poNumber` → ออกเลขที่ให้อัตโนมัติผ่าน `running_number_sequences`
  (`docType='EXTERNAL_APPROVAL'`, prefix `EA-`) ไม่ต้องกรอกเอง
- ตั้ง `status: 'RETURNED'` ครั้งแรก (ยังไม่เคย RETURNED/INSPECTED/COMPLETED/CANCELLED มาก่อน) → เรียก
  `POST /repair-tickets/:id/transition` ให้อัตโนมัติ ย้ายตั๋วจาก `VENDOR_REPAIR` กลับเข้า `TESTING` (ถ้าย้ายไม่สำเร็จ
  เช่นตั๋วถูกยกเลิกไปแล้ว จะบันทึก warning log แต่ไม่ทำให้ request ทั้งหมด fail)

การเข้าสู่ branch นี้ทำผ่าน `POST /repair-tickets/:id/inspection` โดยส่ง `inspectionOutcome: 'SEND_EXTERNAL'` — endpoint
เดิมที่มีอยู่แล้ว แต่ตอนนี้เรียก workflow transition จริง (`DIAGNOSIS → VENDOR_REPAIR`, conditionKey `SEND_EXTERNAL`)
แทนที่การบันทึกแค่ column เฉยๆ แบบเดิม

---

## 5.18 Documents (เอกสารราชการ + เลขที่วิ่งอัตโนมัติ) — 🟡 เฉพาะระบบ (engine)

| Method | Path | Permission | คำอธิบาย |
|---|---|---|---|
| GET | `/document-templates` | `document:print`/`generate` | รายการแบบฟอร์มที่เปิดใช้งาน (registry — ปัจจุบัน seed ไว้ `REPAIR_REQUEST` แบบเดียว) |
| GET | `/documents` | `document:print`/`generate`/`audit:view` | ประวัติเอกสารที่ออกเลขที่แล้วทั้งหมด (filter: ticketId, templateCode) |
| POST | `/documents/generate` | `document:generate` | ออกเลขที่เอกสารจริงจาก `running_number_sequences` (multipart: field `file` = PDF ที่ frontend render แล้ว, `templateCode`, `ticketId?`) |
| GET | `/documents/export?format=xlsx\|csv` | `document:print`/`generate`/`audit:view` | Export ประวัติเอกสารที่ออกเลขที่แล้ว (ใช้ filter เดียวกับ `/documents`, สูงสุด 5,000 แถว) |

**สถาปัตยกรรม**: `document_templates`/`generated_documents` เป็นเพียง "engine" — เนื้อหา/เลย์เอาต์ของแบบฟอร์มแต่ละแบบ
render ที่ฝั่ง frontend เอง (เหมือน `ticket-print-preview.component.ts`) ไม่ใช่ backend เก็บ template ไว้ frontend
render เป็น PDF ผ่าน jsPDF + html2canvas แล้วอัปโหลด blob มาที่ endpoint นี้เพื่อขอเลขที่จริง + เก็บเป็นหลักฐานถาวร
(`generated_documents` เป็น insert-only ledger เชิงตรรกะเช่นเดียวกับ audit log — ไม่มี endpoint แก้ไข/ลบ)

ปัจจุบันต่อสายใช้งานจริงแล้ว **1 ใน 14 แบบ**: `REPAIR_REQUEST` (ใบแจ้งซ่อม) ผ่านปุ่ม "ออกเลขที่เอกสารและบันทึก" ใน
`ticket-print-preview` — แบบฟอร์มราชการที่เหลือรอต้นแบบจริงจากผู้ใช้ เพิ่มได้โดยไม่ต้องแก้ engine (เพิ่มแถวใน
`document_templates` + `running_number_sequences` แล้วสร้าง Angular component render ฟอร์มนั้นเรียก endpoint เดียวกันนี้)

---

## 5.19 ตัวอย่าง OpenAPI 3.0 (Auth module) — รูปแบบที่ swagger-jsdoc generate จริงจาก JSDoc comment เหนือแต่ละ route

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
