# 1. Software Architecture

## ระบบแจ้งซ่อมอุปกรณ์และระบบคอมพิวเตอร์ สำนักงานสาธารณสุขจังหวัดนครราชสีมา
### IT Service Desk & Asset Maintenance Management System (KHD-IT-SUP)

---

## 1.1 ภาพรวมสถาปัตยกรรม (Architecture Overview)

ระบบถูกออกแบบเป็น **Modular Monolith** ฝั่ง Backend (Node.js/Express/TypeScript) ที่ยึดหลัก **Clean Architecture**
ร่วมกับ **Repository Pattern** และ **Service Layer** เพื่อแยก business logic ออกจาก framework/infrastructure
ทำให้ทดสอบง่าย ขยายเป็น microservice ได้ในอนาคตหากจำเป็น โดยไม่ต้องเขียนใหม่ทั้งหมด

Frontend เป็น **Angular SPA** แยก deploy อิสระจาก Backend สื่อสารผ่าน REST API (+ WebSocket สำหรับ realtime)
โดยมี Nginx เป็น Reverse Proxy ทำหน้าที่ TLS termination, static file serving และ routing ไปยัง service ที่ถูกต้อง

```mermaid
flowchart TB
    subgraph Client["Client Devices"]
        Desktop["Desktop Browser"]
        Mobile["Mobile Browser<br/>(QR Scan)"]
        Tablet["Tablet"]
    end

    subgraph Edge["Edge / Reverse Proxy"]
        Nginx["Nginx<br/>TLS, Static Files, Load Balance"]
    end

    subgraph FE["Frontend Container"]
        Angular["Angular SPA<br/>(Angular Material + TailwindCSS)"]
    end

    subgraph BE["Backend Container (Node.js/Express/TypeScript)"]
        API["REST API<br/>Controller Layer"]
        WS["Socket.IO Gateway"]
        SVC["Service Layer<br/>(Business Logic)"]
        REPO["Repository Layer<br/>(Prisma ORM)"]
        MW["Middleware<br/>Auth / RBAC / Validation / Error / RateLimit"]
    end

    subgraph Ext["External Services"]
        SMTP["Gmail SMTP"]
        TG["Telegram Bot API"]
        LINE["LINE Messaging API"]
    end

    subgraph Data["Data Tier"]
        MariaDB[("MariaDB")]
        FS[("File Storage<br/>(Uploads Volume)")]
    end

    Desktop --> Nginx
    Mobile --> Nginx
    Tablet --> Nginx
    Nginx --> Angular
    Nginx --> API
    Nginx --> WS
    API --> MW --> SVC --> REPO --> MariaDB
    SVC --> FS
    SVC --> SMTP
    SVC --> TG
    SVC --> LINE
    WS --> SVC
```

---

## 1.2 หลักการออกแบบ (Design Principles)

| หลักการ | การนำไปใช้ในระบบนี้ |
|---|---|
| **Clean Architecture** | แบ่งเป็น Controller → Service → Repository → Prisma/DB โดย dependency ชี้เข้าหา core เสมอ |
| **Repository Pattern** | ทุก module มี Repository รับผิดชอบเฉพาะการเข้าถึงข้อมูล (Prisma Client) ไม่มี business logic |
| **Service Layer** | รวม business logic, workflow rules, transaction ทั้งหมดไว้ที่ Service เท่านั้น |
| **DTO + Validation** | ทุก endpoint มี Request DTO (Zod schema) validate ก่อนเข้าสู่ Service เสมอ |
| **SOLID** | Single Responsibility ต่อไฟล์/คลาส, Dependency Injection ผ่าน constructor, Interface สำหรับ Repository |
| **Modular Design** | แยกตาม Domain Module (auth, users, assets, repair-tickets, workflow, ...) ไม่ใช่แยกตาม technical layer อย่างเดียว |
| **Immutable Timeline** | Timeline event เป็น insert-only, ห้าม update/delete ที่ระดับ DB (ไม่มี UPDATE/DELETE grant บน timeline table ใน production) |
| **Fail-Safe Defaults** | RBAC เป็น deny-by-default, ทุก route ต้องประกาศ permission ที่ต้องการอย่างชัดเจน |

---

## 1.3 Backend Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Presentation Layer   →  Controllers, Routes, Swagger Docs   │
├─────────────────────────────────────────────────────────────┤
│  Middleware Layer     →  Auth(JWT), RBAC Guard, Validation,  │
│                          RateLimit, Helmet, Error Handler    │
├─────────────────────────────────────────────────────────────┤
│  Application Layer    →  Services (Business Logic, Workflow  │
│                          Engine, Transaction Orchestration)  │
├─────────────────────────────────────────────────────────────┤
│  Domain Layer         →  Entities, DTO, Enums, Domain Errors │
├─────────────────────────────────────────────────────────────┤
│  Infrastructure Layer →  Repository (Prisma), Mailer,        │
│                          Telegram/LINE Client, Socket.IO,    │
│                          QR Generator, File Storage, Logger  │
└─────────────────────────────────────────────────────────────┘
```

**กฎการพึ่งพา (Dependency Rule):** ชั้นบนเรียกใช้ชั้นล่างได้เท่านั้น ห้ามชั้นล่างรู้จักชั้นบน
Controller ไม่เรียก Repository ตรง ๆ ต้องผ่าน Service เท่านั้น — ทำให้ Service ทดสอบได้แบบ unit test โดย mock Repository interface

### ตัวอย่าง flow คำขอ 1 ครั้ง (Create Repair Ticket)

```mermaid
sequenceDiagram
    participant U as ผู้ใช้ (Browser)
    participant N as Nginx
    participant C as RepairTicketController
    participant MW as Middleware (Auth/RBAC/Validate)
    participant S as RepairTicketService
    participant WF as WorkflowEngineService
    participant TL as TimelineService
    participant R as RepairTicketRepository
    participant DB as MariaDB
    participant NOTI as NotificationService

    U->>N: POST /api/v1/repair-tickets
    N->>MW: forward request
    MW->>MW: verify JWT, check permission "ticket:create"
    MW->>MW: validate DTO (Zod)
    MW->>C: next()
    C->>S: createTicket(dto, currentUser)
    S->>R: save ticket (status=SUBMITTED)
    R->>DB: INSERT INTO repair_tickets
    DB-->>R: ticket row
    S->>WF: initWorkflow(ticket, templateId)
    WF->>DB: INSERT workflow_instance + step
    S->>TL: recordEvent(ticket, "SUBMITTED", user)
    TL->>DB: INSERT INTO repair_ticket_timeline (insert-only)
    S->>NOTI: notifyNewTicket(ticket)
    NOTI-->>S: queued (email/telegram/line)
    S-->>C: ticket DTO + ticketNumber
    C-->>N: 201 Created
    N-->>U: JSON response
```

---

## 1.4 Frontend Architecture (Angular)

```
AppComponent
 ├── (public, ไม่ผ่าน shell) LandingComponent — หน้าแรกสาธารณะที่ path "/" (pathMatch: 'full')
 ├── (public) auth/login, auth/forgot-password, auth/reset-password, qr/scan/:token
 ├── core/            Singleton: AuthService, SocketService, NotificationService, Interceptors, Guards, models
 ├── shared/          Reusable: IconComponent, StatusBadge, ConfirmDialog, Timeline UI, PageWatermark,
 │                    UserAvatar (photo หรือ avatar เริ่มต้นตามเพศ), ProfileDialog, AttachmentThumbnail
 ├── layout/          ShellComponent (Sidebar, Toolbar พร้อมกระดิ่งแจ้งเตือน realtime, ThemeToggle)
 └── features/        (Lazy-loaded, 1 โฟลเดอร์ต่อ business module)
      ├── auth/ (login, change-password, notification-channels, forgot-password, reset-password)
      ├── dashboard/, assets/, asset-loans/, repair-tickets/, qr/
      ├── users/, positions/, departments/, divisions/, locations/
      ├── settings/ (notification-settings-page, notification-log-list)
      ├── landing/, help/, misc/ (403/404)
```

- ใช้ **Standalone Components + Lazy Loading (`loadComponent`)** ของ Angular เพื่อลด initial bundle size —
  **ไม่มี NgModule ในโปรเจกต์นี้เลย**
- **Zoneless Change Detection** (`provideZonelessChangeDetection()`) — ไม่ใช้ Zone.js, ทุก component ต้องอัปเดต state
  ผ่าน Signal เท่านั้นจึงจะ trigger re-render ถูกต้อง (`mutate` object ตรง ๆ โดยไม่ผ่าน `signal.set()`/`.update()` จะไม่เห็นผล)
- **State Management**: RxJS + Angular Signals (service-based state, ไม่ใช้ NgRx เพื่อลดความซับซ้อนเกินจำเป็นสำหรับขนาดระบบนี้)
- **HTTP Interceptor** แนบ JWT Access Token ทุก request, ดัก 401 เพื่อ refresh token อัตโนมัติ
- **Socket.IO Client** (`SocketService`) เชื่อมต่อ realtime หลัง login ด้วย `effect()` ที่ตาม `authService.isAuthenticated()`
  (connect/disconnect อัตโนมัติ) ป้อน event เข้า `NotificationService` เพื่ออัปเดตกระดิ่งแจ้งเตือนแบบ live
- **RBAC Guard** ระดับ route (`permissionGuard`) + structural directive (`*khdHasPermission="'asset:delete'"`) ระดับ UI element
- **Path-prefix aware**: production build ตั้ง `baseHref` ผ่าน `angular.json`, asset path ในโค้ดต้องเป็น relative
  (ไม่ขึ้นต้นด้วย `/`) เพื่อ resolve ตาม `<base href>` ให้ถูกต้องใต้ prefix ใดก็ได้ (ดู [Developer Manual § 10.8](10-developer-manual.md))

---

## 1.5 Security Architecture

| ชั้นการป้องกัน | เทคนิค |
|---|---|
| Transport | HTTPS Ready (Nginx TLS termination), HSTS header |
| HTTP Headers | Helmet.js (CSP, X-Frame-Options, X-Content-Type-Options) |
| Rate Limiting | express-rate-limit ต่อ IP + ต่อ endpoint (login เข้มกว่า endpoint ทั่วไป) |
| Authentication | JWT Access Token (อายุสั้น 15 นาที) + Refresh Token (httpOnly cookie, 7 วัน, rotation) |
| Authorization | RBAC middleware ตรวจ permission ต่อ route จาก Permission Matrix |
| Input Validation | Zod schema ทุก DTO, sanitize ก่อนเข้า business logic |
| SQL Injection | Prisma ORM (parameterized query เสมอ, ไม่มี raw string concat) |
| XSS | Helmet CSP + Angular auto-escaping + sanitize rich text input |
| Password | bcrypt (cost factor 12), password policy บังคับความซับซ้อน |
| Secrets | Environment Variables (.env, ไม่ commit), แยก secret ต่อ environment |
| Audit | Audit Log บันทึกทุก action สำคัญ (login, CRUD, delete, print, approve) |
| File Upload | Multer + validate MIME type/size, สแกนนามสกุลไฟล์อันตราย, จัดเก็บนอก web root |

---

## 1.6 Workflow Engine Architecture

Workflow Engine เป็น module อิสระ (`modules/workflow`) ไม่ผูกกับ Repair Ticket โดยตรง เพื่อให้นำไปใช้กับ
กระบวนการอื่นในอนาคตได้ (เช่น Purchase Approval) ออกแบบเป็น **State Machine ที่กำหนดค่าได้ (Configurable State Machine)**

- `workflow_templates` นิยามผัง step ทั้งหมด (Internal Repair / External Repair / ...)
- `workflow_steps` นิยามแต่ละ step: role ที่รับผิดชอบ, SLA (ชั่วโมง), ต้อง approve หรือไม่, เอกสารที่ต้องแนบ
- `workflow_transitions` นิยาม step ถัดไปที่เป็นไปได้จาก step ปัจจุบัน (รองรับ branch เช่น Internal/External)
- `workflow_instances` คือ instance ที่ผูกกับ ticket จริง 1 รายการ, เก็บ step ปัจจุบัน
- ทุกการเปลี่ยน step จะเรียก `TimelineService.recordEvent()` เสมอ (insert-only, ห้ามลบ/แก้ไข)
- SLA คำนวณจาก `workflow_steps.sla_hours` เทียบกับเวลาปัจจุบัน แสดงผลเป็น Progress % และ Remaining SLA

รายละเอียด state diagram ของ Internal/External Repair Workflow อยู่ใน [docs/diagrams/flowchart-workflow.md](diagrams/flowchart-workflow.md)

Phase แรกของระบบ (MVP) จะ implement **Internal Repair Workflow แบบ fixed แต่ configurable ผ่านตาราง** ก่อน
ส่วน **Flow Designer แบบลากวาง (Visual Editor)** และ External Repair 14-step approval chain แบบเต็ม จะเพิ่มใน Phase ถัดไป
(ดู [docs/00-roadmap.md](00-roadmap.md))

---

## 1.7 Technology Stack Summary

| Layer | Technology |
|---|---|
| Backend Runtime | Node.js 20 LTS |
| Backend Framework | Express.js 4 + TypeScript 5 |
| ORM | Prisma ORM (MariaDB provider) |
| Database | MariaDB 11 LTS |
| Auth | JWT (jsonwebtoken) + bcrypt |
| Validation | Zod |
| Realtime | Socket.IO (server) + socket.io-client (frontend) |
| Scheduled Jobs | node-cron (ภายในโปรเซส backend เดียวกัน ไม่ต้องมี infra แยก) |
| File Upload | Multer |
| QR Code | `qrcode` npm package + AES encrypted payload |
| Email | Nodemailer (Gmail SMTP) |
| Chat Notification | Telegram Bot API, LINE Messaging API (ตั้งค่าได้ทั้งผ่าน UI และ `.env`) |
| API Docs | Swagger (swagger-jsdoc + swagger-ui-express) — OpenAPI 3.0 |
| Testing | Jest + Supertest |
| Frontend Framework | Angular 21 (Standalone Components, Zoneless Change Detection) |
| UI Library | Angular Material + TailwindCSS |
| Icons | HeroIcons (inline SVG path data, ไม่ใช้ icon font) |
| Reactive | RxJS + Angular Signals |
| Container | Docker + Docker Compose |
| Reverse Proxy | Nginx |
| Logger | Winston (JSON structured logs, daily rotate) |

---

## 1.8 Deployment Diagram

```mermaid
flowchart LR
    subgraph Internet
        User(("ผู้ใช้งาน"))
    end

    subgraph DockerHost["Docker Host (On-Premise / Cloud VM)"]
        subgraph NginxC["nginx container :80/:443"]
        end
        subgraph FEC["frontend container<br/>Angular build (static)"]
        end
        subgraph BEC["backend container<br/>Node.js API :3000"]
        end
        subgraph DBC["mariadb container :3306"]
        end
        Vol1[(uploads volume)]
        Vol2[(mariadb-data volume)]
        Vol3[(logs volume)]
    end

    User -- "HTTPS /khd-it-sup/*" --> NginxC
    NginxC -- "/khd-it-sup/" --> FEC
    NginxC -- "/khd-it-sup/api/" --> BEC
    NginxC -- "/khd-it-sup/socket.io/" --> BEC
    BEC --> DBC
    BEC --> Vol1
    BEC --> Vol3
    DBC --> Vol2
```

**Path-prefix routing:** ทุก route (frontend, API, WebSocket) อยู่ใต้ path prefix เดียวกัน (`/khd-it-sup/` ตาม default —
ปรับได้) เพื่อให้แชร์ domain/เซิร์ฟเวอร์เดียวกับระบบอื่นได้ Nginx จะ `rewrite` ตัด prefix ออกก่อน proxy ต่อไปยัง
container ภายใน (frontend/backend ไม่รู้จัก prefix นี้เลย) — รายละเอียดเต็มที่
[docs/07-deployment-guide.md § Path Prefix](07-deployment-guide.md)

ดูรายละเอียดเพิ่มเติม: [Folder Structure](02-folder-structure.md) · [Database Design](03-database-design.md) · [ER Diagram](04-er-diagram.md) · [API Design](05-api-design.md)
