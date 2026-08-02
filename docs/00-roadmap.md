# 0. Roadmap การพัฒนา (Delivery Roadmap)

สเปกต้นฉบับของระบบครอบคลุม 38 หัวข้อ และ 28 หมวด deliverable ซึ่งมีขนาดใหญ่ระดับ enterprise
(หลายเดือนงานของทีมพัฒนาจริง) เพื่อให้ได้ **โค้ดที่ทำงานได้จริง สมบูรณ์ ตรวจสอบได้ทุกขั้นตอน** แทนที่จะเป็นโค้ด
โครงร่างที่ไม่สมบูรณ์ ระบบจึงถูกส่งมอบเป็น Phase ดังนี้ โดย Phase 1 คือระบบแกนหลักที่ **รันได้จริง**
และ Phase ถัดไปต่อยอดเพิ่มความสามารถตามสเปกเต็มรูปแบบ

| Phase | ขอบเขต | สถานะ |
|---|---|---|
| **0** | Architecture, Folder Structure, Database Design (SQL+Prisma), ER Diagram, API Design | ✅ เสร็จสมบูรณ์ |
| **1** | Backend Foundation: Config/Logger/Error Handler/Middleware, Auth (JWT+Refresh+RBAC 5 roles), User/Department CRUD | ✅ เสร็จสมบูรณ์ + ทดสอบจริงบน MariaDB |
| **2** | Asset Management (CRUD ครุภัณฑ์ทุกประเภท) + QR Code Generate/Scan/Print + ยืม-คืนครุภัณฑ์ (Asset Loan) | ✅ เสร็จสมบูรณ์ + ทดสอบจริง |
| **3** | Repair Ticket + Workflow Engine หลัก (Internal Repair flow เต็ม 12 ขั้นตอน) + Immutable Timeline | ✅ เสร็จสมบูรณ์ + ทดสอบ lifecycle เต็มทุกขั้นตอน |
| **4** | Notifications: Email (Gmail SMTP) + **Telegram Bot API + LINE Messaging API** (ช่องทางกลางตั้งค่าผ่าน UI + ช่องทางส่วนตัวรายคน) + **Socket.IO Realtime เชื่อมต่อ frontend จริง** + กระดิ่งแจ้งเตือนในแอปพร้อมนับข้อความยังไม่อ่าน + แจ้งเตือนยืมเกินกำหนดคืนอัตโนมัติทุกวัน (node-cron) | ✅ เสร็จสมบูรณ์ + ทดสอบส่งจริงทุกช่องทาง |
| **5** | Dashboard + Reports พื้นฐาน (การ์ด, กราฟหลัก, หลายแท็บตามโมดูล) | ✅ เสร็จสมบูรณ์ |
| **6** | Docker (Backend/Frontend Dockerfile, docker-compose, Nginx reverse proxy พร้อม path-prefix `/khd-it-sup/` สำหรับ deploy ร่วมเซิร์ฟเวอร์กับระบบอื่น) | ✅ เสร็จสมบูรณ์ + ทดสอบ `docker compose up` เต็มระบบจาก scratch |
| **7** | Frontend Angular Foundation (Auth, Layout, Theme, Guard, Interceptor, Landing Page สาธารณะ, ลืมรหัสผ่าน self-service, รูปโปรไฟล์/Avatar) | ✅ เสร็จสมบูรณ์ (Angular 21, zoneless, Material+Tailwind) |
| **8** | Frontend Feature Modules (Asset+Loan, Repair Ticket+Timeline, Dashboard, Users+Positions, Departments+Divisions, Locations, QR Public Scan Page, Settings แจ้งเตือน) | ✅ เสร็จสมบูรณ์ + ทดสอบผ่านเบราว์เซอร์จริง (Playwright) |
| **9** | Swagger, Postman Collection, README, Installation/Deployment Guide, User/Admin/Developer/API Manual | ✅ เสร็จสมบูรณ์ (ปรับปรุงต่อเนื่องให้ตรงกับความสามารถจริงล่าสุด) |
| **10+** | External Repair + Vendor Management, Visual Flow Designer, เอกสารราชการ + เลขที่วิ่งอัตโนมัติ, Kanban Board, Inventory/Spare Part, Audit Log UI, Settings ทั่วไป, ระบบสำรองข้อมูลอัตโนมัติผ่าน UI, Reports ขั้นสูง (Excel/PDF/CSV export), PWA/Installable App, Automated test coverage สำหรับฟีเจอร์ที่เพิ่มหลัง Phase 3 | 🟡 เริ่มแล้ว — ดูรายละเอียดด้านล่าง |

## Phase 10+ รายละเอียดความคืบหน้า

ระบบแกนหลัก (Phase 0-9) สมบูรณ์และทดสอบจริงแล้วทั้งหมด ด้านล่างคือความคืบหน้ารายฟีเจอร์ของ Phase 10+
(อัปเดตทีละฟีเจอร์เมื่อทำเสร็จ ไม่รวบทำท้ายสุดเพื่อไม่ให้เอกสารตกยุค):

| ฟีเจอร์ | สถานะ | หมายเหตุ |
|---|---|---|
| Audit Log UI | ✅ เสร็จสมบูรณ์ | `GET /audit-logs` + หน้า "ประวัติการใช้งานระบบ" (`/settings/audit-log`) filter ตามโมดูล/การกระทำ/ช่วงวันที่ |
| Settings ทั่วไป (ชื่อองค์กร/โลโก้/ธีม/SMTP ผ่าน UI) | ✅ เสร็จสมบูรณ์ | หน้า "ตั้งค่าทั่วไป" (`/settings/general`) แก้ชื่อองค์กร/อัปโหลดโลโก้/สีธีม/SMTP ได้ทันทีไม่ต้อง restart — ทดสอบส่งอีเมลจริงผ่านค่าที่ตั้งใหม่แล้ว (ธีมสีบันทึกได้แต่ยังไม่ผูกเข้า Material theme runtime — เก็บไว้ใช้งานในอนาคต) |
| Kanban Board | ✅ เสร็จสมบูรณ์ | หน้า "บอร์ดงานแจ้งซ่อม" (`/repair-tickets/board`) ลากการ์ดข้ามคอลัมน์ผ่าน Angular CDK drag-drop เรียก `POST /repair-tickets/:id/transition` เดิม ตรวจ transition ที่ถูกต้องจาก `GET /workflow-templates/REPAIR_INTERNAL` ก่อนอนุญาตให้วาง (ไม่มี endpoint ใหม่) |
| รายงาน Export (Excel/PDF/CSV) | ✅ เสร็จสมบูรณ์ | `GET /repair-tickets/export`, `/assets/export` (xlsx/csv), `/dashboard/export` (xlsx หลายชีต) ฝั่ง backend ด้วย `exceljs` — ปุ่ม Export PDF ฝั่ง frontend ใช้ jsPDF+html2canvas (JPEG encoding ไม่ใช่ PNG เพื่อไฟล์เล็กลง ~40-70 เท่า) |
| คลังอะไหล่ (Spare Parts) | ✅ เสร็จสมบูรณ์ | เมนู "คลังอะไหล่" (`/spare-parts`) + ปุ่ม "เบิกอะไหล่" ในหน้ารายละเอียดใบแจ้งซ่อม — ตัดสต็อก atomic ผ่าน `prisma.$transaction` กันสต็อกติดลบ (permission ใหม่ `spare_part:view`/`manage`/`issue`) |
| ซ่อมภายนอก (Vendor Repair Workflow) | ✅ เสร็จสมบูรณ์ | Workflow เพิ่มขั้นตอน `VENDOR_REPAIR` (DIAGNOSIS→ส่งซ่อมภายนอก→รับคืน→TESTING) + เมนู "ผู้ขาย/ผู้รับซ่อมภายนอก" + ใบส่งซ่อมภายนอกในหน้ารายละเอียดใบแจ้งซ่อม (ออกเลข PO อัตโนมัติ, อัปโหลดใบเสนอราคา/ใบเสร็จ, รับเครื่องคืนย้าย workflow กลับอัตโนมัติ) |
| เอกสารราชการ + เลขที่วิ่งอัตโนมัติ | ⬜ ยังไม่เริ่ม | ทำเฉพาะ "ระบบ" (template registry + running number + audit trail) — ไม่รวมเนื้อหาฟอร์มราชการจริง 14 แบบ (รอต้นแบบจากผู้ใช้) |
| Visual Flow Designer | ⏸ เลื่อนออกไป | แก้ workflow ผ่าน SQL ตรงยังใช้งานได้ ไม่ blocking — priority ต่ำกว่าข้ออื่น |

## หลักการสำคัญ

1. **Database Schema ออกแบบให้ครบตั้งแต่ Phase 0** (ครอบคลุมทุก entity ในสเปกเต็ม) เพื่อไม่ต้อง migrate ทำลายข้อมูลภายหลัง
   แต่ **Backend/Frontend code จะสร้างเฉพาะ module ที่ถึง Phase นั้น ๆ** — ตารางที่ยังไม่ใช้งานจะยังไม่มี Service/Controller
   ตัวอย่างที่ยังไม่ถูกใช้งานตอนนี้: `spare_part_transactions` ประเภท `RESERVE` (ยังไม่มี UI เรียกใช้ มีแต่ `ISSUE`/
   `RETURN`/`ADJUST`/`PURCHASE`/`RECEIVE`), `document_templates`, `generated_documents`, `backup_logs`, `approvals` —
   schema พร้อมรองรับแล้วแต่ยังไม่มีโค้ดฝั่ง backend อ้างอิง (`vendors`/`vendor_repair_orders`/`spare_parts` ถูกใช้งาน
   จริงแล้วตั้งแต่ Phase 10+ ข้อ 5-6 — ดูตารางด้านบน)
2. ทุก Phase ส่งมอบเป็นโค้ดที่ build ผ่านและรันได้จริง ไม่ใช่ pseudo-code
3. Timeline/Audit Log/Workflow Engine ถูกวางเป็น core infrastructure ตั้งแต่ Phase 3 เพราะเป็นหัวใจของระบบ
   (ข้อ 37 ในสเปก) — ไม่ใช่ feature เสริมที่เพิ่มทีหลัง
4. Role/Permission Matrix (Super Admin, Admin, IT Officer, Technician, User) ผูกกับทุก endpoint ตั้งแต่ Phase 1
5. **ตาราง `notification_logs` ใช้ channel enum (`EMAIL`/`TELEGRAM`/`LINE`/`PUSH`/`SMS`) ที่ออกแบบไว้ตั้งแต่ Phase 0
   ครอบคลุมถึงกระดิ่งแจ้งเตือนในแอป** (channel="PUSH", recipient=userId) — เมื่อเพิ่มฟีเจอร์ realtime notification
   ใน Phase 4 จึงไม่ต้องเพิ่มตารางใหม่เลย ใช้ schema เดิมที่ออกแบบไว้ล่วงหน้าได้ทันที

## สรุปการทดสอบ (Phase 1-9)

ทุก Phase ผ่านการทดสอบจริง ไม่ใช่แค่ type-check/compile:

- **Backend**: build + boot จริงกับ MariaDB จริง (ไม่ mock), ทดสอบ RBAC (401/403), immutable timeline trigger
  (ยืนยันว่า UPDATE/DELETE ถูก DB ปฏิเสธจริง), workflow lifecycle เต็มจาก SUBMITTED ถึง CLOSED,
  การแจ้งเตือนจริงทุกช่องทาง (อีเมล/Telegram/LINE/Push บันทึกลง `notification_logs` และยืนยัน delivery จริง),
  Socket.IO realtime (เชื่อมต่อจริง, badge อัปเดตโดยไม่ต้อง reload หน้า), งาน cron แจ้งเตือนยืมเกินกำหนดคืน
  (เรียกใช้จริงยืนยันผลลัพธ์), self-service password reset (ยืนยัน token ใช้ครั้งเดียว/หมดอายุถูกต้อง), Jest test suite
- **Docker**: `docker build` ทุก image (backend/frontend) + `docker compose up` เต็มระบบจาก database ว่างเปล่า
  (ทดสอบ auto-init ผ่าน `docker-entrypoint-initdb.d` จริง ไม่ใช่ manual load), reverse-proxy path-prefix
  `/khd-it-sup/` ทดสอบครบทุกเส้นทาง (API, WebSocket, ไฟล์แนบ, QR scan, cookie refresh session)
- **Frontend**: `ng build` ทั้ง development และ production configuration ผ่านทั้งคู่, ทดสอบผ่านเบราว์เซอร์จริง
  (Playwright headless) ครบทุกหน้าหลัก (Landing → Login → Dashboard → Assets → ยืม-คืน → Repair Tickets+Timeline
  → Users → QR Scan → ลืมรหัสผ่าน → กระดิ่งแจ้งเตือน) รวมถึง Dark Mode

## ช่องว่างที่ทราบอยู่แล้ว (นอกเหนือจาก Phase 10+ ด้านบน)

จากการตรวจสอบความสมบูรณ์ของระบบ (code audit เทียบกับ schema จริง ไม่ใช่แค่เอกสาร) พบเพิ่มเติมว่า:

- **Automated test coverage บางมาก** เทียบกับขนาดระบบปัจจุบัน — มีไฟล์ทดสอบหลักไม่กี่ไฟล์ (auth, jwt, pagination)
  ฟีเจอร์ใหญ่ที่เพิ่มทีหลัง (workflow เต็ม, ยืม-คืน, การแจ้งเตือนทุกช่องทาง, avatar, realtime) ยังไม่มี automated test
  คุ้มครองเลย ปัจจุบันพึ่งพาการทดสอบ end-to-end ผ่านเบราว์เซอร์จริงเป็นหลักแทน
- **ไม่รองรับ PWA** — ติดตั้งเป็นแอปบนมือถือ (add to home screen) ไม่ได้

ดูต่อ: [Architecture](01-architecture.md) · [Database Design](03-database-design.md) · [API Design](05-api-design.md)
