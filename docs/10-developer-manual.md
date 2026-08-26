# 10. Developer Manual (คู่มือนักพัฒนา)

## 10.1 เริ่มต้นพัฒนา

ดู [docs/06-installation-guide.md § 6.3](06-installation-guide.md#63-วิธีที่-2-รัน-local-dev-ผ่าน-devbat-แนะนำสำหรับนักพัฒนา-windows)
สำหรับการตั้งค่า local dev environment — สรุปสั้น: `dev.bat` เปิด dev database แยกจาก production (container/พอร์ต/volume คนละชุด)
แล้วรัน backend (`:3500`) + frontend (`:4500/khd-it-sup/`) ให้อัตโนมัติ ส่วนการ deploy ขึ้น production ใช้ `deploy-prod.bat`
(ดู [docs/06-installation-guide.md § 6.5](06-installation-guide.md#65-การ-deploy-ขึ้น-production-จากเครื่อง-dev-deploy-probat))

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
| `dev.bat` | root | เริ่ม dev database (Docker, แยกจาก production) + เปิดหน้าต่าง backend/frontend dev server ให้ทั้งคู่ |
| `stop-dev.bat` | root | หยุด dev database (เก็บข้อมูลในไว้ volume ไม่ลบ) |
| `deploy-prod.bat` | root | typecheck+build ทั้งคู่ แล้ว build/up docker + restart nginx ขึ้น production จริง (มีถามยืนยันก่อน) |
| `npm run dev` | backend/ | รัน dev server พร้อม hot-reload (พอร์ต 3500 ตาม `backend/.env`) |
| `npm run build` | backend/ | Compile TypeScript + resolve path alias |
| `npx prisma studio` | backend/ | เปิด GUI ดู/แก้ไขข้อมูลในฐานข้อมูล |
| `npx prisma generate` | backend/ | สร้าง Prisma Client ใหม่หลังแก้ `schema.prisma` |
| `npm start` | frontend/ | รัน dev server ที่ `http://localhost:4500/khd-it-sup/` (`ng serve` พร้อม `--serve-path`+`--proxy-config`) |
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
- **ไม่มี Tailwind Preflight/CSS reset ในโปรเจกต์นี้**: `border-t-2`/`border-r-2` เฉย ๆ จะไม่เห็นเส้นเลยถ้าไม่ใส่
  `border-solid` ด้วย (ไม่มี default `border-style`), การบังคับ `border-style: solid` รวมกับการไม่มี `border-width: 0`
  reset ทำให้ด้านที่ไม่ได้ระบุ width ได้ browser default (~3px) มาแทน (ต้องใส่ `border-0` ก่อนเสมอ), และ `<p>` ไม่มี
  margin reset (browser default ~1em) — ถ้าเจอ element สูง/มี gap เกินคาดโดยไม่รู้สาเหตุ ให้สงสัยจุดนี้ก่อน
- **Path-prefix deployment (`/khd-it-sup/`) กระทบหลายจุดที่ควรระวัง** เมื่อเพิ่ม prefix ใหม่หรือเปลี่ยน prefix:
  - **Refresh-token cookie**: `Path` ของ cookie ต้องรวม prefix ภายนอก (`externalPathPrefix()` derive จาก
    `env.FRONTEND_BASE_URL`) ไม่ใช่แค่ `env.API_PREFIX` ภายใน — ไม่งั้น browser จะไม่ส่ง cookie กลับมาหลัง reload
  - **URL ไฟล์ที่ backend สร้าง** (`fileUrl` ของรูปครุภัณฑ์/ไฟล์แนบ/avatar) อ้างอิงจาก `API_PREFIX` ภายในเท่านั้น
    ไม่รู้จัก prefix ภายนอก — ฝั่ง frontend ต้องแปลงผ่าน `resolveBackendFileUrl()` (`core/utils/file-url.util.ts`)
    ก่อนเรียก blob fetch ทุกครั้ง
  - **Socket.IO client**: การส่ง prefix ผ่าน connection URL เฉย ๆ **ไม่** ทำให้ client ต่อ path ที่ถูกต้อง (ต่างจาก
    `HttpClient` ที่ resolve จาก `apiBaseUrl` ตรง ๆ) ต้องพับ prefix เข้าไปใน `path` option ของ `io()` ตรง ๆ
    (ดู `frontend/src/app/core/services/socket.service.ts`) — ถ้าลืมจะเห็น WebSocket handshake วน 404 ไม่หยุด
  - **Angular asset path ในโค้ด** (เช่น `<img src="logo1.png">`) ต้องเป็น relative path (ไม่ขึ้นต้นด้วย `/`) เพื่อให้
    resolve ตาม `<base href>` ที่ตั้งจาก `baseHref` ใน `angular.json` (production config เท่านั้น) — path ที่ขึ้นต้น
    ด้วย `/` จะ bypass `<base href>` และชี้ไปที่ root เสมอ ไม่ว่าจะ deploy ใต้ prefix ใดก็ตาม
  - **หลัง `docker compose up -d <service>` ที่ recreate container ใดก็ตามที่ nginx proxy ไปหา**: ต้อง
    `docker compose restart nginx` ตามด้วยเสมอ — nginx cache IP ของ container ไว้ตอน resolve ครั้งแรก ถ้า container
    ถูกสร้างใหม่ (ได้ IP ใหม่) แต่ nginx ไม่ restart จะได้ `502 Bad Gateway` (`connect() failed ... Connection refused`)
- **Timeline เป็น insert-only แม้แต่ backfill ก็ทำไม่ได้**: ถ้า schema ของ event เปลี่ยน (เช่น เพิ่ม field ใหม่) ข้อมูลเก่า
  ที่ insert ไปแล้วจะไม่มี field ใหม่นี้ตลอดไป (DB trigger ปฏิเสธ UPDATE) — ถ้าต้องกู้คืนข้อมูลที่ "หายไป" จาก field เก่า
  (เช่น `attachmentUrl` เดี่ยวก่อนมี `attachmentUrls` แบบ array) ให้ทำแบบ **read-time correlation** แทน (จับคู่กับข้อมูล
  ที่เกี่ยวข้องด้วย timestamp ใกล้เคียงกันตอน query ไม่ใช่แก้ข้อมูลใน DB) ดูตัวอย่างที่ `timeline.component.ts`
  (`resolveEventAttachments()`)
- **ไฟล์แนบ/รูปโปรไฟล์ต้องโหลดผ่าน blob ไม่ใช่ `<img src>` ตรง ๆ**: endpoint `/files/:subdir/:filename` ต้อง
  authenticate (Bearer header) เสมอ ไม่ใช่ static URL สาธารณะ — browser จะไม่แนบ header ให้กับ `<img src>` ธรรมดา
  จึงต้อง fetch ผ่าน `HttpClient` (`responseType: 'blob'`) แล้วแปลงเป็น `URL.createObjectURL()` แทน (ดู
  `khd-attachment-thumbnail`/`khd-user-avatar` เป็นตัวอย่าง — อย่าลืม `URL.revokeObjectURL()` ตอน component destroy)
