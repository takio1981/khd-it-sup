# KHD-IT-SUP

**ระบบแจ้งซ่อมอุปกรณ์และระบบคอมพิวเตอร์ สำนักงานสาธารณสุขจังหวัดนครราชสีมา**
IT Service Desk & Asset Maintenance Management System

![Primary Color](https://img.shields.io/badge/Primary-%23006C45-006C45) ![Secondary Color](https://img.shields.io/badge/Secondary-%2300A86B-00A86B) ![License](https://img.shields.io/badge/license-Internal-lightgrey)

---

## ภาพรวมระบบ

ระบบบริหารจัดการครุภัณฑ์คอมพิวเตอร์และการแจ้งซ่อมแบบครบวงจร สำหรับสำนักงานสาธารณสุขจังหวัดนครราชสีมา
รองรับการแจ้งซ่อมผ่านการสแกน QR Code ติดครุภัณฑ์, ติดตามสถานะงานซ่อมแบบ Realtime ผ่าน Workflow Engine ที่กำหนดค่าได้,
Timeline แบบ immutable ที่บันทึกทุกการกระทำถาวร, แจ้งเตือนอัตโนมัติผ่านอีเมล, และแดชบอร์ดสรุปผลเชิงบริหาร

## สถานะการพัฒนา

ระบบถูกส่งมอบเป็น Phase ตาม [docs/00-roadmap.md](docs/00-roadmap.md) — **Phase 1-8 (ระบบแกนหลัก) เสร็จสมบูรณ์และผ่านการทดสอบจริงแล้ว**
ทั้ง Backend, Frontend, Database, และ Docker โดยทดสอบ end-to-end ผ่านเบราว์เซอร์จริงและ `docker compose` เต็มระบบ
ส่วนความสามารถขั้นสูง (Flow Designer, Telegram/LINE, เอกสารราชการ 14 แบบ, Kanban, Inventory เต็มรูปแบบ) อยู่ใน Phase 10+

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20 LTS, Express.js, TypeScript, Prisma ORM, JWT, Socket.IO, Nodemailer |
| Frontend | Angular 21 (standalone, zoneless), Angular Material, TailwindCSS, RxJS, Signals |
| Database | MariaDB 11 |
| Container | Docker, Docker Compose, Nginx (reverse proxy) |
| API Docs | Swagger / OpenAPI 3.0 (`/api-docs`) |
| Testing | Jest, Supertest |

## Quick Start (Docker — แนะนำ)

```bash
git clone <repo-url> khd-it-sup && cd khd-it-sup
cp .env.example .env      # แก้ไขค่า secret/password ให้เหมาะสมก่อนใช้งานจริง
docker compose up -d --build
```

เปิด `http://localhost` — เข้าสู่ระบบด้วย `admin` / `Admin@12345` (บังคับเปลี่ยนรหัสผ่านทันทีหลัง deploy จริง)

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
