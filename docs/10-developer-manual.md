# 10. Developer Manual (คู่มือนักพัฒนา)

## 10.1 เริ่มต้นพัฒนา

ดู [docs/06-installation-guide.md § 6.3](06-installation-guide.md#63-วิธีที่-2-รัน-local-dev-ไม่ผ่าน-docker--สำหรับนักพัฒนา)
สำหรับการตั้งค่า local dev environment

## 10.2 สถาปัตยกรรมโดยสรุป

อ่านฉบับเต็มที่ [docs/01-architecture.md](01-architecture.md) — สรุปสั้น:

- **Backend**: Clean Architecture — `Controller → Service → Repository → Prisma`. Business logic ทั้งหมดอยู่ใน Service เท่านั้น
- **Frontend**: Angular standalone components, zoneless change detection, Signals สำหรับ state, lazy-loaded feature routes
- **Database**: MariaDB, UUID primary key ทุกตาราง, Timeline/Audit log เป็น insert-only (บังคับด้วย DB trigger)

## 10.3 การเพิ่ม Module ใหม่ในฝั่ง Backend

โครงมาตรฐานของทุก module (`backend/src/modules/<name>/`):

```
modules/<name>/
├── dto/<name>.dto.ts              # Zod schema สำหรับ validate request
├── repositories/<name>.repository.ts  # เข้าถึง Prisma เท่านั้น ไม่มี business logic
├── services/<name>.service.ts     # business logic ทั้งหมดอยู่ที่นี่
├── controllers/<name>.controller.ts   # แปลง req/res <-> service เท่านั้น ไม่มี logic
└── routes.ts                      # ผูก middleware (authenticate/requirePermission/validateRequest)
```

ขั้นตอน:

1. เพิ่ม model ใน `backend/prisma/schema.prisma` (ถ้าต้องใช้ตารางใหม่) + เพิ่ม DDL ใน `database/schema.sql` ด้วยเสมอ
   (schema.sql คือ source of truth จริงสำหรับ production — ดู header ของ `schema.prisma`)
2. `npx prisma generate` เพื่ออัปเดต Prisma Client type
3. สร้างไฟล์ตามโครงด้านบน
4. เพิ่ม permission code ใหม่ใน `backend/src/common/constants/permissions.const.ts` (ถ้ามี action ใหม่) และใน
   `database/seed.sql` (ตาราง `permissions` + `role_permissions`)
5. Mount router ใหม่ใน `backend/src/app.ts`
6. เพิ่ม JSDoc `@openapi` annotation เหนือทุก route เพื่อให้ Swagger สร้างเอกสารอัตโนมัติ (ดูตัวอย่างใน module อื่น)
7. เขียน test ใน `backend/tests/`

### Repository ที่ต้องรันภายใน Transaction

ถ้า business logic ต้องเขียนหลายตารางแบบ atomic (เช่น สร้าง ticket + workflow instance + timeline event พร้อมกัน)
ให้ repository method รับ parameter `db: PrismaClientOrTx = prisma` (ดูตัวอย่างใน `repairTicket.repository.ts`)
แล้วเรียกผ่าน `prisma.$transaction(async (tx) => { ... })` ใน service — ห้าม hardcode `prisma` ตรง ๆ ใน repository
เพราะจะทำให้ไม่สามารถรวมอยู่ใน transaction เดียวกันได้

## 10.4 การเพิ่ม Feature ใหม่ในฝั่ง Frontend

```
features/<name>/
├── <name>-list/<name>-list.component.ts   # หน้ารายการ (ถ้ามี)
├── <name>-detail/<name>-detail.component.ts
└── <name>-form/<name>-form.component.ts   # Dialog สำหรับสร้าง/แก้ไข
```

1. เพิ่ม model ใน `core/models/`, service ใน `core/services/` (คืนค่าเป็น Observable, unwrap `data` field เสมอ)
2. เพิ่ม route ใน `app.routes.ts` — ใช้ `loadComponent` (lazy load) + `canActivate: [permissionGuard]` + `data: { permissions: [...] }`
3. คอมโพเนนต์ที่รับ route param ผ่าน `input()` (จาก `withComponentInputBinding()`) **ต้องอ่านค่าใน `effect()`** ไม่ใช่อ่านตรง ๆ ใน
   constructor — เพราะ router set ค่าหลัง constructor ทำงาน (ดู `TicketDetailComponent`/`AssetDetailComponent` เป็นตัวอย่างที่ถูกต้อง)
4. เพิ่ม nav item ใน `layout/nav-items.ts` พร้อม permission ที่ต้องมี
5. ใช้ `*khdHasPermission="'xxx:yyy'"` ซ่อน/แสดง UI element ตามสิทธิ์ ระดับปุ่ม/action

## 10.5 Coding Conventions

- **Backend**: ESLint + Prettier (`npm run lint`, `npm run format`) — TypeScript strict mode เปิดเต็ม
- **Frontend**: Angular strict mode, `ChangeDetectionStrategy.OnPush` ทุก component, ใช้ Signals แทน manual subscription
  เมื่อเป็นไปได้
- ทุก error message ที่ผู้ใช้เห็นต้องเป็นภาษาไทย (ผ่าน `AppError` ฝั่ง backend)
- ห้าม hardcode permission string — ใช้ค่าจาก `PERMISSIONS` const เสมอ (backend) / `Permission` type (frontend)

## 10.6 การรัน Test

```bash
cd backend
npm test                 # ต้องมี MariaDB ที่ apply database/schema.sql แล้ว (DATABASE_URL ใน .env)
npm run test:coverage
```

Integration test (`tests/integration/`) ยิง request ผ่าน `createApp()` จริงเข้า database จริง (ไม่ mock Prisma)
เพื่อให้ครอบคลุมพฤติกรรม DB trigger (immutable timeline) และ constraint จริงด้วย

## 10.7 คำสั่งที่ใช้บ่อย

| คำสั่ง | ตำแหน่ง | คำอธิบาย |
|---|---|---|
| `npm run dev` | backend/ | รัน dev server พร้อม hot-reload |
| `npm run build` | backend/ | Compile TypeScript + resolve path alias |
| `npx prisma studio` | backend/ | เปิด GUI ดู/แก้ไขข้อมูลในฐานข้อมูล |
| `npx prisma generate` | backend/ | สร้าง Prisma Client ใหม่หลังแก้ `schema.prisma` |
| `npm start` / `npx ng serve` | frontend/ | รัน dev server |
| `npx ng build --configuration production` | frontend/ | Build production |

## 10.8 ข้อควรระวังที่พบระหว่างพัฒนา (Gotchas)

- **Prisma + Alpine**: ต้องมี `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` ใน `schema.prisma` และ `apk add openssl`
  ใน Dockerfile ทุก stage ที่รัน `prisma generate`/`prisma client` — ไม่งั้นจะ error `libssl.so.1.1 not found` ตอนรันใน container
- **Multi-stage Docker + Prisma**: ต้อง copy `node_modules/.prisma` จาก build stage เข้า runtime stage ด้วยเสมอ (ไม่ใช่แค่
  `node_modules` จาก prod-deps stage) ไม่งั้น Prisma Client จะโหลด engine ไม่เจอ
- **Angular route input binding**: `input()` ที่ผูกกับ route param (`withComponentInputBinding()`) ยังไม่มีค่าตอน constructor
  ทำงาน — ต้องอ่านใน `effect()` เท่านั้น
- **Structural directive กับ `input.required()`**: จะโยน `NG0950` ถ้า effect รอบแรกอ่านค่าก่อน Angular bind เสร็จ — ใช้
  `input()` พร้อมค่า default แทนสำหรับ structural directive
