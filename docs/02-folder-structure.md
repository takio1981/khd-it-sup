# 2. Folder Structure

```
khd-it-sup/
├── backend/                            # Node.js + Express + TypeScript API
│   ├── src/
│   │   ├── config/                     # env config loader, constants (app.config.ts, db.config.ts, jwt.config.ts, cors.config.ts)
│   │   │
│   │   ├── common/                     # cross-module shared code (ไม่มี business logic เฉพาะ domain)
│   │   │   ├── middleware/             # authenticate, rbacGuard, validateRequest, rateLimiter, errorHandler, requestLogger
│   │   │   ├── errors/                 # AppError, NotFoundError, ValidationError, ForbiddenError, ...
│   │   │   ├── utils/                  # pagination, apiResponse, asyncHandler, dateUtils, ticketNumberGenerator
│   │   │   ├── interfaces/             # shared TS interfaces (IPaginatedResult, IAuthUser, ...)
│   │   │   ├── constants/              # permissions.const.ts, roles.const.ts, statusColor.const.ts
│   │   │   └── guards/                 # permission definitions per role (Permission Matrix)
│   │   │
│   │   ├── infrastructure/             # การเชื่อมต่อระบบภายนอก / cross-cutting infra
│   │   │   ├── database/               # Prisma client singleton, transaction helper
│   │   │   ├── logger/                 # Winston logger config
│   │   │   ├── mailer/                 # Nodemailer + Gmail SMTP transport
│   │   │   ├── socket/                 # Socket.IO server, event emitter service
│   │   │   ├── messaging/telegram/     # Telegram Bot client (Phase 10+)
│   │   │   ├── messaging/line/         # LINE Messaging API client (Phase 10+)
│   │   │   ├── storage/                # Multer disk storage config, file helpers
│   │   │   └── qrcode/                 # QR generate + AES payload encrypt/decrypt
│   │   │
│   │   ├── modules/                    # 1 โฟลเดอร์ต่อ 1 Domain Module (Modular Design)
│   │   │   ├── auth/                   # login, refresh token, logout, change password
│   │   │   │   ├── controllers/  services/  repositories/  dto/  validators/  routes.ts
│   │   │   ├── users/                  # User CRUD, reset password, avatar
│   │   │   ├── departments/            # Department/Position CRUD
│   │   │   ├── assets/                 # Asset CRUD ทุกประเภทครุภัณฑ์
│   │   │   ├── qrcode/                 # Generate/Print/Bulk Print/Scan resolve
│   │   │   ├── repair-tickets/         # Repair Ticket CRUD, submit, assign
│   │   │   ├── workflow/               # Workflow Template/Step/Transition Engine
│   │   │   ├── timeline/               # Immutable Timeline event recorder + query
│   │   │   ├── notifications/          # Email/Telegram/LINE dispatch + log
│   │   │   ├── dashboard/              # Dashboard aggregate queries
│   │   │   ├── audit-log/              # Audit log recorder + query
│   │   │   └── settings/               # SMTP/Telegram/LINE/Org/RunningNumber settings
│   │   │
│   │   ├── app.ts                      # Express app assembly (middleware, routes, swagger)
│   │   └── server.ts                   # HTTP server bootstrap + Socket.IO attach + graceful shutdown
│   │
│   ├── prisma/
│   │   ├── schema.prisma               # Prisma schema (ครบทุก entity ตาม ER Diagram)
│   │   ├── migrations/                 # Prisma migration history
│   │   └── seed.ts                     # Seed data (roles, permissions, admin user, departments, categories)
│   │
│   ├── tests/
│   │   ├── unit/                       # Service layer unit tests (mock repository)
│   │   └── integration/                # API endpoint tests (Supertest + test DB)
│   │
│   ├── uploads/                        # ไฟล์แนบที่ผู้ใช้อัปโหลด (gitignored, mount เป็น volume)
│   ├── logs/                           # Winston log output (gitignored)
│   ├── .env.example
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── jest.config.ts
│
├── frontend/                           # Angular SPA
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/                   # Singleton: AuthService, TokenInterceptor, ErrorInterceptor, guards, models
│   │   │   ├── shared/                 # Reusable components/pipes/directives (StatusBadge, DataTable, ConfirmDialog)
│   │   │   ├── layout/                 # AppShell, Sidebar, Topbar, Breadcrumb
│   │   │   ├── features/
│   │   │   │   ├── auth/               # Login page
│   │   │   │   ├── dashboard/          # Executive Dashboard
│   │   │   │   ├── assets/             # Asset list/detail/form
│   │   │   │   ├── repair-tickets/     # Ticket list/detail/timeline/kanban
│   │   │   │   ├── qr/                 # Public QR scan landing page (no-auth route)
│   │   │   │   ├── users/              # User management
│   │   │   │   └── settings/           # System settings
│   │   │   ├── app.routes.ts
│   │   │   └── app.config.ts
│   │   ├── assets/{images,icons}/
│   │   ├── environments/               # environment.ts / environment.prod.ts
│   │   ├── styles/                     # Tailwind + Material theme SCSS
│   │   ├── index.html
│   │   └── main.ts
│   ├── Dockerfile
│   ├── nginx.conf                      # serve static Angular build inside frontend container
│   ├── angular.json
│   ├── package.json
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── database/
│   ├── schema.sql                      # Complete MariaDB DDL (ทุกตาราง, PK, FK, Index)
│   └── seed.sql                        # Seed data แบบ SQL (ทางเลือกแทน prisma seed)
│
├── docker/
│   └── nginx/
│       └── nginx.conf                  # Reverse proxy: route /, /api, /socket.io
│
├── docs/                                # เอกสารทั้งหมด (สถาปัตยกรรม, คู่มือ, diagram)
│   └── diagrams/                        # Mermaid: ER, Use Case, Sequence, Class, Component, Deployment, Flowchart
│
├── postman/
│   └── khd-it-sup.postman_collection.json
│
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

## หลักการจัดโครงสร้าง

- **แยกตาม Domain ก่อน แล้วค่อยแยกตาม Technical Layer ภายใน** (`modules/assets/controllers`, `modules/assets/services`) —
  ทำให้หา code ของ feature หนึ่ง ๆ ได้ในที่เดียว ไม่ต้องกระโดดข้ามหลายโฟลเดอร์ top-level
- **`common/` vs `infrastructure/`**: `common/` คือโค้ดที่ไม่ผูกกับระบบภายนอกใด ๆ (pure TS), `infrastructure/`
  คือโค้ดที่ผูกกับ external system (DB, SMTP, Telegram, filesystem)
- ทุก module มีโครงเดียวกัน (`controllers/ services/ repositories/ dto/ validators/ routes.ts`) เพื่อให้ onboarding
  นักพัฒนาใหม่คาดเดาตำแหน่งไฟล์ได้โดยไม่ต้องถาม
