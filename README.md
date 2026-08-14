# KHD-IT-SUP

**ระบบแจ้งซ่อมอุปกรณ์และระบบคอมพิวเตอร์ สำนักงานสาธารณสุขจังหวัดนครราชสีมา**
IT Service Desk & Asset Maintenance Management System

![Primary Color](https://img.shields.io/badge/Primary-%23006C45-006C45) ![Secondary Color](https://img.shields.io/badge/Secondary-%2300A86B-00A86B) ![License](https://img.shields.io/badge/license-Internal-lightgrey)

---

## ภาพรวมระบบ

ระบบบริหารจัดการครุภัณฑ์คอมพิวเตอร์, การแจ้งซ่อม, และการยืม-คืนครุภัณฑ์แบบครบวงจร สำหรับสำนักงานสาธารณสุขจังหวัดนครราชสีมา
รองรับการแจ้งซ่อมผ่านการสแกน QR Code ติดครุภัณฑ์, ติดตามสถานะงานซ่อมแบบ Realtime (Socket.IO) ผ่าน Workflow Engine ที่กำหนดค่าได้,
Timeline แบบ immutable ที่บันทึกทุกการกระทำถาวร, แจ้งเตือนอัตโนมัติผ่านอีเมล/Telegram/LINE ทั้งช่องทางส่วนกลางและส่วนตัวรายคน,
กระดิ่งแจ้งเตือนในแอปแบบ realtime, แจ้งเตือนยืมครุภัณฑ์เกินกำหนดคืนอัตโนมัติทุกวัน, ระบบลืมรหัสผ่านแบบ self-service,
รูปโปรไฟล์ผู้ใช้, และแดชบอร์ดสรุปผลเชิงบริหาร

รองรับการ deploy แบบ path-prefix (`/khd-it-sup/`) เพื่อแชร์ domain/เซิร์ฟเวอร์เดียวกับระบบอื่นได้ (ดู
[docs/07-deployment-guide.md](docs/07-deployment-guide.md))

## สถานะการพัฒนา

ระบบถูกส่งมอบเป็น Phase ตาม [docs/00-roadmap.md](docs/00-roadmap.md) — **Phase 1-9 (ระบบแกนหลัก + Realtime + การแจ้งเตือนเต็มรูปแบบ)
เสร็จสมบูรณ์และผ่านการทดสอบจริงแล้ว** ทั้ง Backend, Frontend, Database, และ Docker โดยทดสอบ end-to-end ผ่านเบราว์เซอร์จริงและ
`docker compose` เต็มระบบ รวมถึง Telegram/LINE (ทั้งช่องทางกลางและส่วนตัว), Socket.IO realtime, กระดิ่งแจ้งเตือน,
ลืมรหัสผ่าน, และแจ้งเตือนยืมเกินกำหนดคืนอัตโนมัติ ที่เดิมอยู่ใน Phase 10+ ได้ถูกทำเสร็จแล้วเช่นกัน

**Phase 10+ คืบหน้าไปมากแล้ว**: Audit Log UI, Settings ทั่วไป (ชื่อองค์กร/โลโก้/SMTP/ธีมผ่าน UI), Kanban Board,
รายงาน Export (Excel/PDF/CSV), คลังอะไหล่ (Spare Part Inventory), งานซ่อมภายนอก (ส่งร้าน/บริษัท พร้อมออกเลข PO
อัตโนมัติ), ระบบเอกสารราชการ + เลขที่วิ่งอัตโนมัติ (เฉพาะ engine — ใช้งานจริงแล้ว 1 ใน 14 แบบฟอร์ม รอต้นแบบราชการ
ที่เหลือ), และ **PWA ติดตั้งเป็นแอปบนมือถือได้ + แจ้งซ่อม/ยืม-คืนอุปกรณ์แบบ self-service ผ่านสแกน QR** (พนักงานทุกคน
login แล้วยืม-คืนอุปกรณ์ของตัวเองผ่านสแกน QR ได้เลย แจ้งเตือนอัตโนมัติถึงผู้ยืม+เจ้าหน้าที่ไอที)
**เสร็จสมบูรณ์และทดสอบจริงแล้วทั้งหมด** — ส่วนที่**ยังไม่เริ่ม**: Visual Flow Designer, ระบบสำรองข้อมูล
อัตโนมัติผ่าน UI, Automated test coverage เพิ่มเติม — ดูรายละเอียดที่
[docs/00-roadmap.md](docs/00-roadmap.md)

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20 LTS, Express.js, TypeScript, Prisma ORM, JWT, Socket.IO, Nodemailer, node-cron |
| Frontend | Angular 21 (standalone, zoneless), Angular Material, TailwindCSS, RxJS, Signals, socket.io-client |
| Database | MariaDB 11 |
| Container | Docker, Docker Compose, Nginx (reverse proxy, path-prefix routing) |
| API Docs | Swagger / OpenAPI 3.0 (`/api-docs`) |
| Testing | Jest, Supertest |

## Quick Start (Docker — แนะนำ)

```bash
git clone <repo-url> khd-it-sup && cd khd-it-sup
cp .env.example .env      # แก้ไขค่า secret/password ให้เหมาะสมก่อนใช้งานจริง
docker compose up -d --build
```

เปิด **`http://localhost/khd-it-sup/`** (ต้องมี path `/khd-it-sup/` เสมอ — เข้า `http://localhost` เฉย ๆ จะได้ 404 โดยตั้งใจ
เพื่อรองรับการแชร์เซิร์ฟเวอร์กับระบบอื่น) แล้วเข้าสู่ระบบด้วย `admin` / `Admin@12345` (บังคับเปลี่ยนรหัสผ่านทันทีหลัง deploy จริง)

รายละเอียดครบถ้วน: [docs/06-installation-guide.md](docs/06-installation-guide.md)

## โครงสร้างโปรเจกต์

```
khd-it-sup/
├── backend/        Node.js/Express/TypeScript REST API (Clean Architecture)
├── frontend/       Angular SPA (Material + Tailwind)
├── database/       MariaDB DDL (schema.sql) + seed data (seed.sql)
├── docker/         Nginx reverse proxy config
├── docs/           สถาปัตยกรรม, ER Diagram, API Design, คู่มือทุกประเภท
├── postman/        Postman Collection สำหรับทดสอบ API
├── docker-compose.yml
└── .env.example
```

รายละเอียดทุกโฟลเดอร์: [docs/02-folder-structure.md](docs/02-folder-structure.md)

## เอกสารประกอบ

| เอกสาร | คำอธิบาย |
|---|---|
| [00-roadmap.md](docs/00-roadmap.md) | แผนการส่งมอบเป็น Phase |
| [01-architecture.md](docs/01-architecture.md) | สถาปัตยกรรมซอฟต์แวร์ |
| [02-folder-structure.md](docs/02-folder-structure.md) | โครงสร้างโฟลเดอร์ |
| [03-database-design.md](docs/03-database-design.md) | การออกแบบฐานข้อมูล |
| [04-er-diagram.md](docs/04-er-diagram.md) | ER Diagram |
| [05-api-design.md](docs/05-api-design.md) | รายการ REST API endpoint |
| [06-installation-guide.md](docs/06-installation-guide.md) | คู่มือติดตั้ง (Docker และ Local Dev) |
| [07-deployment-guide.md](docs/07-deployment-guide.md) | คู่มือ Deploy ขึ้นระบบจริง |
| [08-user-manual.md](docs/08-user-manual.md) | คู่มือผู้ใช้งาน |
| [09-admin-manual.md](docs/09-admin-manual.md) | คู่มือผู้ดูแลระบบ |
| [10-developer-manual.md](docs/10-developer-manual.md) | คู่มือนักพัฒนา |
| [11-api-manual.md](docs/11-api-manual.md) | คู่มือการใช้งาน API |

Swagger UI (interactive API docs เมื่อรันระบบแล้ว): `http://localhost/api-docs`

## License

Internal use — สำนักงานสาธารณสุขจังหวัดนครราชสีมา
