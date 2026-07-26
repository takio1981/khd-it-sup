# 0. Roadmap การพัฒนา (Delivery Roadmap)

สเปกต้นฉบับของระบบครอบคลุม 38 หัวข้อ และ 28 หมวด deliverable ซึ่งมีขนาดใหญ่ระดับ enterprise
(หลายเดือนงานของทีมพัฒนาจริง) เพื่อให้ได้ **โค้ดที่ทำงานได้จริง สมบูรณ์ ตรวจสอบได้ทุกขั้นตอน** แทนที่จะเป็นโค้ด
โครงร่างที่ไม่สมบูรณ์ ระบบจะถูกส่งมอบเป็น Phase ดังนี้ โดย Phase 1 คือระบบแกนหลักที่ **รันได้จริง**
และ Phase ถัดไปจะต่อยอดเพิ่มความสามารถตามสเปกเต็มรูปแบบ

| Phase | ขอบเขต | สถานะ |
|---|---|---|
| **0** | Architecture, Folder Structure, Database Design (SQL+Prisma), ER Diagram, API Design | ✅ เสร็จสมบูรณ์ |
| **1** | Backend Foundation: Config/Logger/Error Handler/Middleware, Auth (JWT+Refresh+RBAC 5 roles), User/Department CRUD | ✅ เสร็จสมบูรณ์ + ทดสอบจริงบน MariaDB |
| **2** | Asset Management (CRUD ครุภัณฑ์ทุกประเภท) + QR Code Generate/Scan/Print | ✅ เสร็จสมบูรณ์ + ทดสอบจริง |
| **3** | Repair Ticket + Workflow Engine หลัก (Internal Repair flow เต็ม) + Immutable Timeline | ✅ เสร็จสมบูรณ์ + ทดสอบ lifecycle เต็ม 11/11 ขั้นตอน |
| **4** | Notifications (Email/Gmail SMTP) + Socket.IO Realtime | ✅ เสร็จสมบูรณ์ + ทดสอบการส่งจริง |
| **5** | Dashboard + Reports พื้นฐาน (การ์ด, กราฟหลัก) | ✅ เสร็จสมบูรณ์ |
| **6** | Docker (Backend/Frontend Dockerfile, docker-compose, Nginx reverse proxy) | ✅ เสร็จสมบูรณ์ + ทดสอบ `docker compose up` เต็มระบบจาก scratch |
| **7** | Frontend Angular Foundation (Auth, Layout, Theme, Guard, Interceptor) | ✅ เสร็จสมบูรณ์ (Angular 21, zoneless, Material+Tailwind) |
| **8** | Frontend Feature Modules (Asset, Repair Ticket+Timeline, Dashboard, Users, Departments, QR Public Scan Page) | ✅ เสร็จสมบูรณ์ + ทดสอบผ่านเบราว์เซอร์จริง (Playwright) |
| **9** | Swagger, Postman Collection, README, Installation/Deployment Guide, User/Admin/Developer/API Manual | ✅ เสร็จสมบูรณ์ (ตามขอบเขต Phase 1-8 ที่สร้างจริง) |
| **10+** | External Repair 14-step Approval Chain, Visual Flow Designer, Telegram+LINE, เอกสารราชการ 14 แบบ, Kanban Board, Inventory/Spare Part เต็มรูปแบบ, Vendor Management, Audit Log UI, Backup อัตโนมัติผ่าน UI, Reports ขั้นสูง (Excel/PDF/CSV export), Settings UI | ⬜ ยังไม่เริ่ม |

## หลักการสำคัญ

1. **Database Schema ออกแบบให้ครบตั้งแต่ Phase 0** (ครอบคลุมทุก entity ในสเปกเต็ม) เพื่อไม่ต้อง migrate ทำลายข้อมูลภายหลัง
   แต่ **Backend/Frontend code จะสร้างเฉพาะ module ที่ถึง Phase นั้น ๆ** — ตารางที่ยังไม่ใช้งานจะยังไม่มี Service/Controller
2. ทุก Phase ส่งมอบเป็นโค้ดที่ build ผ่านและรันได้จริง ไม่ใช่ pseudo-code
3. Timeline/Audit Log/Workflow Engine ถูกวางเป็น core infrastructure ตั้งแต่ Phase 3 เพราะเป็นหัวใจของระบบ
   (ข้อ 37 ในสเปก) — ไม่ใช่ feature เสริมที่เพิ่มทีหลัง
4. Role/Permission Matrix (Super Admin, Admin, IT Officer, Technician, User) ผูกกับทุก endpoint ตั้งแต่ Phase 1

## สรุปการทดสอบ (Phase 1-9)

ทุก Phase ผ่านการทดสอบจริง ไม่ใช่แค่ type-check/compile:

- **Backend**: build + boot จริงกับ MariaDB จริง (ไม่ mock), ทดสอบ RBAC (401/403), immutable timeline trigger
  (ยืนยันว่า UPDATE/DELETE ถูก DB ปฏิเสธจริง), workflow lifecycle เต็ม 11 ขั้นตอนจาก SUBMITTED ถึง CLOSED,
  การแจ้งเตือนอีเมลจริง (บันทึกลง `notification_logs`), Jest test suite (16 tests ผ่านทั้งหมด)
- **Docker**: `docker build` ทุก image (backend/frontend) + `docker compose up` เต็มระบบจาก database ว่างเปล่า
  (ทดสอบ auto-init ผ่าน `docker-entrypoint-initdb.d` จริง ไม่ใช่ manual load)
- **Frontend**: `ng build` ทั้ง development และ production configuration ผ่านทั้งคู่, ทดสอบผ่านเบราว์เซอร์จริง
  (Playwright headless) ครบทุกหน้าหลัก (Login → Dashboard → Assets → Repair Tickets+Timeline → Users → QR Scan)
  รวมถึง Dark Mode — พบและแก้ bug จริง 3 รายการระหว่างทดสอบ (dependency ที่ขาดหาย, route-input timing bug,
  backend build ที่ไม่ทันสมัย) ก่อนยืนยันว่าใช้งานได้จริง
