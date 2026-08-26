# 6. Installation Guide (คู่มือติดตั้ง)

## 6.1 Prerequisites

| เครื่องมือ | เวอร์ชันขั้นต่ำ | ใช้สำหรับ |
|---|---|---|
| Docker + Docker Compose | Docker 24+ | รันทั้งระบบแบบ container (production) — และรัน dev database แบบแยกส่วนตอน local dev ด้วย |
| Node.js | 20 LTS | รัน backend/frontend แบบ local dev (ไม่ผ่าน Docker) |
| MariaDB | 10.11+ / 11.x | ฐานข้อมูล — ไม่จำเป็นต้องติดตั้งเองถ้าใช้ Docker (ทั้ง production และ dev มี MariaDB container ให้แล้ว) |
| Git | ล่าสุด | clone โปรเจกต์ |

> **นักพัฒนาทุกคนควรมี Docker ติดตั้งไว้เสมอ** แม้จะรัน backend/frontend แบบ local dev (ไม่ผ่าน container) ก็ตาม
> เพราะฐานข้อมูล dev (§6.3) รันผ่าน Docker เพื่อแยกข้อมูลออกจาก production โดยสมบูรณ์

---

## 6.2 วิธีที่ 1: ติดตั้งด้วย Docker (Production)

```bash
git clone <repo-url> khd-it-sup
cd khd-it-sup

# 1) สร้างไฟล์ .env จากตัวอย่าง แล้วแก้ไขค่า secret ให้เหมาะสม
cp .env.example .env
```

แก้ไขค่าสำคัญใน `.env` อย่างน้อยก่อนใช้งานจริง:

```env
MARIADB_PASSWORD=...           # เปลี่ยนจากค่า default
MARIADB_ROOT_PASSWORD=...      # เปลี่ยนจากค่า default
JWT_ACCESS_SECRET=...          # สุ่มค่าใหม่ อย่างน้อย 32 ตัวอักษร
JWT_REFRESH_SECRET=...         # สุ่มค่าใหม่ อย่างน้อย 32 ตัวอักษร
QR_AES_SECRET=...              # ต้องมีความยาวพอดี 32 ตัวอักษร (AES-256)
SMTP_USER / SMTP_PASS          # Gmail App Password (ดูหัวข้อ 6.7)
```

> สร้าง secret แบบสุ่มด้วยคำสั่ง: `node -e "console.log(require('crypto').randomBytes(32).toString('hex').slice(0,32))"`

> **พอร์ตชนกับ container/โปรแกรมอื่นที่มีอยู่แล้วบนเครื่อง?** แก้ `MARIADB_PORT` และ/หรือ `NGINX_PORT` ใน `.env` เป็นพอร์ตว่าง
> ก่อน `docker compose up` — เช็คพอร์ตที่ใช้อยู่แล้วด้วย `docker ps` (ดูคอลัมน์ PORTS ของทุก container บนเครื่อง ไม่ใช่แค่โปรเจกต์นี้)

```bash
# 2) build และรันทั้งระบบ — ขั้นตอนนี้จะ "สร้างฐานข้อมูล" ให้อัตโนมัติด้วย (ดูกล่องคำอธิบายด้านล่าง)
docker compose up -d --build

# 3) ตรวจสอบสถานะ container ทั้งหมด (ต้องเป็น healthy)
docker compose ps
```

Container ที่รัน:

| Service | Container | หน้าที่ |
|---|---|---|
| `mariadb` | khd_it_sup_db | ฐานข้อมูล (auto-init จาก `database/schema.sql` + `seed.sql` ในครั้งแรกที่ volume ว่างเปล่าเท่านั้น) |
| `backend` | khd_it_sup_backend | REST API + Socket.IO (Node.js) |
| `frontend` | khd_it_sup_frontend | Angular static build ผ่าน Nginx ภายใน container |
| `nginx` | khd_it_sup_nginx | Reverse proxy หน้าบ้าน (พอร์ต 80/443) |

> **การสร้างฐานข้อมูลเกิดขึ้นตรงนี้โดยอัตโนมัติ**: image `mariadb:11` ทางการจะรันไฟล์ `.sql` ทุกไฟล์ใน
> `/docker-entrypoint-initdb.d/` (ซึ่ง `docker-compose.yml` mount `database/schema.sql` และ `database/seed.sql` ไว้ที่โฟลเดอร์นี้)
> **เฉพาะตอนที่ data directory ของ container นั้นว่างเปล่าเท่านั้น** (เท่ากับ volume `mariadb-data` ยังไม่เคยมีข้อมูลมาก่อน)
> ถ้าเคยรันมาแล้วครั้งหนึ่ง ไฟล์เหล่านี้จะ **ไม่ถูกรันซ้ำอีก** แม้จะแก้ไข `schema.sql` แล้ว `docker compose up` ใหม่ก็ตาม —
> ดูวิธีสร้างฐานข้อมูลใหม่ทั้งหมด หรือแก้ schema ของฐานข้อมูลที่มีข้อมูลอยู่แล้ว ที่ **§6.4**

เปิดเบราว์เซอร์ที่ **`http://localhost/khd-it-sup/`** (ต้องมี path `/khd-it-sup/` ต่อท้ายเสมอ) แล้วเข้าสู่ระบบด้วย:

```
Username: admin
Password: Admin@12345
```

> **สำคัญ — path prefix บังคับ:** ทั้งแอปอยู่ใต้ path `/khd-it-sup/` โดยตั้งใจ (ดู `docker/nginx/nginx.conf`) เพื่อให้
> deploy ร่วมกับระบบอื่นบน domain/เซิร์ฟเวอร์เดียวกันได้ในอนาคต การเข้า `http://localhost` เฉย ๆ (ไม่มี prefix) จะได้
> **404 โดยตั้งใจ** ไม่ใช่ bug ถ้าต้องการเปลี่ยน prefix ดู [docs/07-deployment-guide.md § Path Prefix](07-deployment-guide.md)

**สำคัญ:** ระบบบังคับให้เปลี่ยนรหัสผ่านทันทีหลังเข้าสู่ระบบครั้งแรก (`must_change_password = true`) — เป็นความตั้งใจเพื่อความปลอดภัย

### คำสั่งที่ใช้บ่อย

```bash
docker compose logs -f backend      # ดู log backend แบบ realtime
docker compose restart backend      # restart เฉพาะ backend
docker compose down                 # หยุดทุก container (เก็บ volume/ข้อมูลไว้)
docker compose down -v              # หยุดและลบข้อมูลทั้งหมด (ระวัง — ลบฐานข้อมูลถาวร)
```

---

## 6.3 วิธีที่ 2: รัน Local Dev ผ่าน dev.bat (แนะนำสำหรับนักพัฒนา, Windows)

ออกแบบมาให้ **แยกขาดจาก production โดยสิ้นเชิง** — ทั้งพอร์ต, container, และฐานข้อมูล คนละชุดกันหมด เพื่อให้แก้โค้ด/ทดสอบ
ได้อย่างอิสระโดยไม่มีทางกระทบข้อมูลจริงหรือทำระบบที่ผู้ใช้งานอยู่ล่ม

| | Production (`docker-compose.yml`) | Dev (`docker-compose.dev.yml` + `dev.bat`) |
|---|---|---|
| เว็บแอป | `http://localhost/khd-it-sup/` (nginx, พอร์ต 80) | `http://localhost:4500/khd-it-sup/` (`ng serve` โดยตรง) |
| Backend API | ผ่าน nginx เท่านั้น (ไม่ expose พอร์ตตรง) | `http://localhost:3500/api/v1` (`tsx watch`, hot-reload) |
| ฐานข้อมูล | container `khd_it_sup_db` พอร์ต `3309` | container **แยกต่างหาก** `khd_it_sup_dev_db` พอร์ต `3308` |
| ข้อมูล | ข้อมูลจริงที่ผู้ใช้งานใช้อยู่ | seed data สด ๆ จาก `database/seed.sql` — ลบ/แก้ทดลองได้อิสระ |

### ขั้นตอนติดตั้งครั้งแรก

```bash
git clone <repo-url> khd-it-sup
cd khd-it-sup

# 1) สร้างไฟล์ env ทั้ง 2 ไฟล์จากตัวอย่าง
cp .env.example .env
cp backend/.env.example backend/.env
```

`.env` (root) ใช้โดย `docker-compose.dev.yml` (credential ของ MariaDB) — ค่า default ใช้รันได้ทันทีสำหรับเครื่อง dev
(ไม่ต้องเข้มงวดเท่า production) ส่วน `backend/.env` ใช้โดย backend เวลารันแบบ local โดยตรง ค่าที่สำคัญ (ตั้งไว้ให้แล้ว
ตรงกันแบบ default):

```env
PORT=3500                                                    # พอร์ต backend dev
CORS_ORIGIN=http://localhost:4500                            # origin ของ frontend dev
FRONTEND_BASE_URL=http://localhost:4500/khd-it-sup           # ใช้สร้างลิงก์ QR/อีเมลตอน dev
DATABASE_URL="mysql://khd_app:change-this-strong-password@localhost:3308/khd_it_sup"  # ชี้ไปที่ dev database (พอร์ต 3308)
```

> รหัสผ่านใน `DATABASE_URL` ต้องตรงกับ `MARIADB_PASSWORD` ใน `.env` (root) เสมอ (คนละไฟล์ แต่ต้องเป็นค่าเดียวกัน
> เพราะ MariaDB container ใช้ `MARIADB_PASSWORD` ตอนสร้าง user `khd_app`) — ค่า default ใน `.env.example` ทั้งสองไฟล์
> ตรงกันอยู่แล้ว (`change-this-strong-password`) ถ้าจะเปลี่ยนรหัสผ่านต้องแก้ **ทั้งสองไฟล์ให้ตรงกัน** ไม่งั้น backend
> จะเชื่อมต่อฐานข้อมูลไม่ได้ (`Access denied for user`)

```bash
# 2) ติดตั้ง dependencies ทั้ง 2 ฝั่ง
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# 3) รันทุกอย่างด้วยคำสั่งเดียว
dev.bat
```

`dev.bat` จะทำตามลำดับนี้ให้อัตโนมัติ:

1. `docker compose -f docker-compose.dev.yml up -d` — สร้าง/สตาร์ท container ฐานข้อมูล dev (`khd_it_sup_dev_db`,
   พอร์ต 3308, auto-init จาก `schema.sql`+`seed.sql` เหมือนกับ production ทุกประการแต่คนละ volume)
2. รอจน container ฐานข้อมูล**พร้อมใช้งานจริง** (`healthy`) ก่อนเปิดขั้นตอนถัดไป
3. เปิดหน้าต่าง terminal ใหม่ 2 หน้าต่างแยกกัน:
   - **Backend (dev :3500)** — `npm run dev` ใน `backend/` (`tsx watch` — แก้โค้ดแล้ว restart ให้อัตโนมัติ)
   - **Frontend (dev :4500)** — `npm start` ใน `frontend/` (`ng serve` พร้อม hot-reload/live-reload)

เมื่อพร้อมแล้วเปิดเบราว์เซอร์ที่ **`http://localhost:4500/khd-it-sup/`** (ต้องมี `/khd-it-sup/` เหมือน production — ดูเหตุผลที่
§6.3.1 ด้านล่าง) แล้ว login ด้วย `admin` / `Admin@12345` เช่นเดียวกับ production (คนละฐานข้อมูลกัน แต่ seed ข้อมูลตั้งต้นเหมือนกัน)

**หยุดการทำงาน**: ปิดหน้าต่าง backend/frontend ทั้งสองที่เปิดขึ้นมา แล้วรัน `stop-dev.bat` (หยุด/ลบ container ฐานข้อมูล dev —
**ข้อมูลใน volume ยังอยู่ครบ ไม่ได้ลบ**, ครั้งหน้ารัน `dev.bat` ใหม่ได้ข้อมูลเดิม)

### 6.3.1 ทำไม URL ต้องมี `/khd-it-sup/` ตอน dev ด้วย

เพื่อให้ dev environment มี "รูปร่าง" URL เหมือน production เป๊ะ (ลด surprise ตอน deploy จริง) `frontend/package.json`
สั่ง `ng serve` ด้วย 2 flag สำคัญ:

- `--serve-path /khd-it-sup/` — ให้ dev server serve แอปที่ path นี้ (ตรงกับ `baseHref` ที่ตั้งไว้ในการตั้งค่า `development`
  ของ `frontend/angular.json`)
- `--proxy-config proxy.conf.dev.json` — ให้ `ng serve` proxy request ที่ขึ้นต้นด้วย `/khd-it-sup/api`,
  `/khd-it-sup/api-docs`, และ `/khd-it-sup/socket.io` (รวม WebSocket) ไปที่ backend dev (`localhost:3500`) โดยตัด prefix
  ออกก่อนเสมอ — พฤติกรรมเดียวกับที่ `docker/nginx/nginx.conf` ทำใน production ทุกประการ

ผลคือ request ทุกตัวจาก browser ไปที่ origin เดียวกัน (`localhost:4500`) ไม่ต้องพึ่ง CORS ข้าม origin เลย — ถ้าเข้า
`http://localhost:4500/` เฉย ๆ (ไม่มี prefix) จะไม่เจอ route ที่ถูกต้อง เข้าผ่าน `/khd-it-sup/` เท่านั้น

### 6.3.2 รันแบบ manual โดยไม่ผ่าน `dev.bat` (ทำเองทีละขั้นตอน)

ใช้เมื่อต้องการ debug เฉพาะจุด หรือใช้ระบบปฏิบัติการอื่นที่ไม่ใช่ Windows:

```bash
# 1) เริ่ม dev database
docker compose -f docker-compose.dev.yml up -d

# 2) รอให้ healthy (ดูจนกว่าคอลัมน์ STATUS จะขึ้น "healthy")
docker compose -f docker-compose.dev.yml ps

# 3) เทอร์มินัลที่ 1 — backend
cd backend
npx prisma generate     # ครั้งแรกเท่านั้น หรือหลังแก้ schema.prisma
npm run dev              # http://localhost:3500

# 4) เทอร์มินัลที่ 2 — frontend
cd frontend
npm start                 # http://localhost:4500/khd-it-sup/ (เทียบเท่า dev.bat)
```

หยุด dev database: `docker compose -f docker-compose.dev.yml down` (เทียบเท่า `stop-dev.bat`)

---

## 6.4 การสร้างฐานข้อมูลและตั้งค่าการเชื่อมต่อ (โดยละเอียด)

### 6.4.1 ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | หน้าที่ |
|---|---|
| `database/schema.sql` | DDL ทั้งหมด (CREATE TABLE/INDEX/TRIGGER) — **source of truth จริง** ของโครงสร้างฐานข้อมูล |
| `database/seed.sql` | ข้อมูลตั้งต้น (roles, permissions, role_permissions, บัญชี admin, หน่วยงานตัวอย่าง ฯลฯ) |
| `backend/prisma/schema.prisma` | คำอธิบาย schema แบบ Prisma (สำหรับ generate Prisma Client ใช้ query เท่านั้น — **ไม่ใช่**
  ตัวสร้างฐานข้อมูลจริง ต่างจากโปรเจกต์ Prisma ทั่วไปที่ใช้ `prisma migrate`) |

> **ห้ามรัน `prisma migrate dev` หรือ `prisma db push` กับโปรเจกต์นี้เด็ดขาด** — วิธีแก้ schema ที่ถูกต้องอยู่ที่ §6.4.4

### 6.4.2 วิธีที่ 1 — สร้างฐานข้อมูลผ่าน Docker (อัตโนมัติ, แนะนำ)

ทั้ง production (`docker-compose.yml`) และ dev (`docker-compose.dev.yml`) mount ไฟล์ `schema.sql`/`seed.sql`
เข้า `/docker-entrypoint-initdb.d/` ของ container MariaDB เหมือนกัน — image ทางการจะรันไฟล์เหล่านี้ให้อัตโนมัติ
**ครั้งเดียวตอนที่ volume ว่างเปล่าเท่านั้น** (ตอน container ถูกสร้างขึ้นครั้งแรก)

ไม่ต้องทำอะไรเพิ่มนอกจาก `docker compose up -d` (production) หรือ `docker compose -f docker-compose.dev.yml up -d` (dev)

**สร้างใหม่ทั้งหมด (ลบข้อมูลทิ้งแล้วเริ่มจาก seed สด ๆ)**:

```bash
# Production — อันตราย ใช้เฉพาะตอนยังไม่มีข้อมูลจริงเท่านั้น!
docker compose down -v && docker compose up -d --build

# Dev — ปลอดภัย ใช้ได้ทุกเมื่อที่ต้องการล้างข้อมูลทดลองกลับไปเป็น seed เริ่มต้น
docker compose -f docker-compose.dev.yml down -v && docker compose -f docker-compose.dev.yml up -d
```

`-v` คือสิ่งที่ทำให้ volume (และข้อมูลทั้งหมดในนั้น) ถูกลบจริง — ไม่มี `-v` แปลว่าแค่หยุด container เฉย ๆ ข้อมูลยังอยู่ครบ

### 6.4.3 วิธีที่ 2 — สร้างฐานข้อมูลด้วยมือ (ไม่ผ่าน Docker เลย — ใช้ MariaDB ที่ติดตั้งเองบนเครื่อง)

```bash
# เข้า MariaDB client ด้วยสิทธิ์ที่สร้าง database/user ได้ (เช่น root)
mysql -u root -p

# ภายใน mysql client — สร้าง database + user แยกให้แอปใช้ (อย่าใช้ root ใน production)
CREATE DATABASE khd_it_sup CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'khd_app'@'%' IDENTIFIED BY 'your-strong-password';
GRANT ALL PRIVILEGES ON khd_it_sup.* TO 'khd_app'@'%';
FLUSH PRIVILEGES;
EXIT;

# รัน DDL + seed ตามลำดับ (schema ก่อน seed เสมอ — seed อ้างอิง FK ไปที่ตารางใน schema)
mysql -u root -p khd_it_sup < database/schema.sql
mysql -u root -p khd_it_sup < database/seed.sql
```

### 6.4.4 การตั้งค่าการเชื่อมต่อ (`DATABASE_URL`)

Backend เชื่อมฐานข้อมูลผ่านตัวแปรเดียวคือ `DATABASE_URL` ใน `backend/.env` รูปแบบ:

```
mysql://<user>:<password>@<host>:<port>/<database_name>
```

| ค่า | Production (ผ่าน Docker) | Dev (ผ่าน `dev.bat`) | Local MariaDB ของตัวเอง |
|---|---|---|---|
| host | `mariadb` (ชื่อ service ใน docker network — backend คุยกับ DB ผ่านชื่อ service ไม่ใช่ `localhost`) | `localhost` | `localhost` |
| port | `3306` (พอร์ตภายใน container เสมอ ไม่ใช่ `MARIADB_PORT` ที่ map ออกมาที่ host) | `3308` | `3306` (หรือพอร์ตที่ติดตั้งจริง) |
| user/pass | ตรงกับ `MARIADB_USER`/`MARIADB_PASSWORD` ใน `.env` (root) | ตรงกับ `.env` (root) เช่นกัน — container เดียวกันชุด credential | ตามที่สร้างเอง (§6.4.3) |

> **ตัวแปร `DATABASE_URL` ใช้จริงเฉพาะตอนรัน backend นอก Docker เท่านั้น** (`npm run dev` / `npm run build && npm start`) —
> ตอนรันผ่าน `docker-compose.yml`/`docker-compose.dev.yml` ค่านี้ถูกประกอบขึ้นให้อัตโนมัติจากตัวแปรอื่นใน `.env` (root)
> ไม่ต้องตั้งเองในนั้น (ดู `DATABASE_URL:` ใน `docker-compose.yml`)

### 6.4.5 ตรวจสอบว่าเชื่อมต่อสำเร็จ

```bash
cd backend
npx prisma studio          # เปิด GUI ดู/แก้ข้อมูล — ถ้าเชื่อมต่อไม่ได้จะ error ชัดเจนทันที
```

หรือทดสอบตรง ๆ ด้วย MariaDB client (ตัวอย่างสำหรับ dev database พอร์ต 3308):

```bash
mysql -h 127.0.0.1 -P 3308 -u khd_app -p khd_it_sup -e "SHOW TABLES;"
```

เห็นรายชื่อตาราง (เช่น `users`, `repair_tickets`, `assets` ฯลฯ) แปลว่าเชื่อมต่อสำเร็จ

### 6.4.6 แก้ไขโครงสร้างฐานข้อมูลที่มีข้อมูลอยู่แล้ว (ไม่ใช่สร้างใหม่)

เมื่อต้องเพิ่ม/แก้ไขตารางระหว่างพัฒนาโปรเจกต์ต่อ (ฐานข้อมูลมีข้อมูลอยู่แล้ว ห้ามลบทิ้งสร้างใหม่) ให้ทำตามลำดับนี้เท่านั้น
(**ห้ามใช้ `prisma migrate dev`/`prisma db push` เด็ดขาด** ตามนโยบายโปรเจกต์):

1. แก้ `database/schema.sql` ให้มี DDL ล่าสุด (นี่คือ source of truth จริง — ต้องแก้ไฟล์นี้เสมอไม่ว่าจะแก้ที่ไหนอื่นด้วยหรือไม่)
2. รัน `ALTER TABLE`/`CREATE TABLE` ที่ตรงกันจริงกับฐานข้อมูลที่กำลังใช้งานอยู่ตรง ๆ ผ่าน `docker exec`:
   ```bash
   docker exec khd_it_sup_db mariadb -u root -p"$MARIADB_ROOT_PASSWORD" khd_it_sup -e "ALTER TABLE ... ;"
   ```
   (สำหรับ dev database เปลี่ยน container เป็น `khd_it_sup_dev_db`)
3. แก้ `backend/prisma/schema.prisma` ให้ตรงกับโครงสร้างใหม่
4. รัน `npx prisma generate` (สร้าง Prisma Client ใหม่เท่านั้น — **ไม่แตะฐานข้อมูลจริง**)

ดูรายละเอียดเพิ่มเติมที่ [docs/10-developer-manual.md § 10.3](10-developer-manual.md#103-การเพิ่ม-module-ใหม่ในฝั่ง-backend)

---

## 6.5 การ Deploy ขึ้น Production จากเครื่อง Dev (`deploy-prod.bat`)

หลังแก้โค้ดและทดสอบผ่าน dev environment (§6.3) เรียบร้อยแล้ว ใช้ `deploy-prod.bat` เพื่อ build + ขึ้นระบบจริงในคำสั่งเดียว:

```bash
deploy-prod.bat
```

ขั้นตอนที่สคริปต์ทำให้ (มีถามยืนยันก่อนเริ่มเสมอ เพราะกระทบระบบที่ผู้ใช้งานใช้อยู่จริง):

1. Typecheck + build backend (`npm run build`) — หยุดทันทีถ้าไม่ผ่าน ระบบจริงจะไม่ถูกแตะต้องเลย
2. Typecheck + build frontend (`tsc --noEmit` + `ng build --configuration production`)
3. `docker compose build backend frontend`
4. `docker compose up -d backend frontend`
5. `docker compose restart nginx` (จำเป็นเสมอหลัง recreate container — nginx cache IP เดิมไว้ ไม่งั้นจะได้ `502 Bad Gateway`)

ดูรายละเอียด production checklist เพิ่มเติมที่ [docs/07-deployment-guide.md](07-deployment-guide.md)

---

## 6.6 การรัน Test

```bash
cd backend
npm test                    # Jest unit + integration tests (ต้องมี MariaDB ที่ apply schema.sql แล้ว)
npm run test:coverage       # พร้อม coverage report
```

> แนะนำให้รันเทียบกับ dev database (§6.3) ไม่ใช่ production — สลับ `DATABASE_URL` ใน `backend/.env` ไปที่พอร์ต 3308 ก่อนรัน test

---

## 6.7 การตั้งค่า Gmail SMTP (สำหรับแจ้งเตือนทางอีเมล)

1. เปิดใช้งาน 2-Step Verification บัญชี Gmail ที่จะใช้ส่ง
2. สร้าง [App Password](https://myaccount.google.com/apppasswords) (ไม่ใช่รหัสผ่านบัญชีปกติ)
3. ใส่ค่าใน `.env`:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=<App Password 16 หลัก>
   SMTP_FROM_EMAIL=your-email@gmail.com
   ```
4. Restart backend — หากไม่ได้ตั้งค่า SMTP_USER ระบบจะข้ามการส่งอีเมลจริงแต่ยังคงบันทึก log ไว้ (`notification_logs`)
   เพื่อให้ dev/test ทำงานได้โดยไม่ต้องพึ่ง SMTP จริง

## 6.7b การตั้งค่า Telegram Bot / LINE Messaging API (ทางเลือก)

ตั้งค่าได้ **2 ทาง** — ผ่านหน้าเว็บ (แนะนำ, ไม่ต้อง restart) หรือผ่าน `.env` (ใช้เป็นค่า fallback ถ้ายังไม่ได้ตั้งผ่านหน้าเว็บ):

**ผ่านหน้าเว็บ:** เข้าสู่ระบบด้วยบัญชีที่มีสิทธิ์ `settings:manage` (Super Admin/Admin) → เมนู **"ตั้งค่าแจ้งเตือน"** → แท็บ **"ตั้งค่า"**
กรอก Chat ID/Bot Token (Telegram) หรือ Group ID/Channel Access Token (LINE) แล้วกด "บันทึก" — มีผลทันทีโดยไม่ต้อง restart backend

**ผ่าน `.env` (fallback):**
```env
TELEGRAM_BOT_TOKEN=<token จาก @BotFather>
TELEGRAM_DEFAULT_CHAT_ID=<chat/group id ที่บอทถูกเชิญเข้าไปแล้ว>
LINE_CHANNEL_ACCESS_TOKEN=<channel access token แบบ long-lived>
LINE_CHANNEL_SECRET=<channel secret>
```

ผู้ใช้แต่ละคนยังตั้งค่าช่องทางส่วนตัวของตนเอง (Telegram Chat ID / LINE User ID) ได้ที่เมนูโปรไฟล์ → "ช่องทางการแจ้งเตือนส่วนตัว"
เพื่อรับแจ้งเตือนตรงถึงตัวเองคู่ขนานกับกลุ่มไอทีกลาง

---

## 6.8 Troubleshooting

| อาการ | สาเหตุที่เป็นไปได้ | วิธีแก้ |
|---|---|---|
| เข้า `http://localhost` แล้วได้ 404 | ปกติ — ระบบตั้งใจให้ต้องเข้าผ่าน path prefix `/khd-it-sup/` เสมอ | เข้า `http://localhost/khd-it-sup/` (production) หรือ `http://localhost:4500/khd-it-sup/` (dev) แทน |
| `docker compose up` ค้างที่ mariadb / พอร์ตชนกัน | พอร์ตถูกใช้งานอยู่แล้วบนเครื่อง (โดย container โปรเจกต์อื่น หรือโปรแกรมอื่น เช่น Laragon/XAMPP) | เช็คด้วย `docker ps` (ดู PORTS ของทุก container) แล้วเปลี่ยน `MARIADB_PORT`/`NGINX_PORT` (production) หรือ `DEV_MARIADB_PORT` (dev, ใน `.env` root) เป็นพอร์ตว่าง |
| `dev.bat` ค้าง/error ตอนรอ dev database healthy | Docker Desktop ยังไม่เปิด หรือ container เก่าค้างอยู่ในสถานะผิดปกติ | เปิด Docker Desktop ก่อน แล้วลองใหม่ — หรือ `docker compose -f docker-compose.dev.yml down` แล้วรัน `dev.bat` อีกครั้ง |
| `npm start`/`npm run dev` ขึ้น `EADDRINUSE: address already in use` | มี process ค้างจาก session ก่อนหน้าที่ไม่ได้ปิดสะอาด (พบบ่อยเมื่อปิดหน้าต่าง terminal โดยไม่กด Ctrl+C ให้ process ลูกตายก่อน) | หา process ที่ถือพอร์ตนั้นแล้วปิด — Windows: `netstat -ano \| findstr :3500` ดู PID แล้ว `taskkill /PID <pid> /F` |
| Backend error `Environment variable not found: DATABASE_URL` | ยังไม่ได้สร้างไฟล์ `backend/.env` | `cp backend/.env.example backend/.env` แล้วแก้ค่า (ดู §6.4.4) |
| Prisma error เรื่อง `libssl`/OpenSSL บน Alpine | ปกติมีการติดตั้ง `openssl` และตั้ง `binaryTargets` ไว้ใน `schema.prisma` แล้ว หากยังพบปัญหาให้ตรวจสอบว่า build image ใหม่ล่าสุด | `docker compose build --no-cache backend` |
| `502 Bad Gateway` หลัง `docker compose up -d backend` (recreate เฉพาะ container backend/frontend) | Nginx cache IP ของ container เดิมไว้ตอน resolve DNS ครั้งแรก พอ container ถูก recreate จะได้ IP ใหม่แต่ nginx ยังชี้ IP เก่าอยู่ | `docker compose restart nginx` ทุกครั้งหลัง recreate backend หรือ frontend (`deploy-prod.bat` ทำให้อัตโนมัติแล้ว) |
| กระดิ่งแจ้งเตือน/Socket.IO ไม่เชื่อมต่อ (เช็คได้จาก DevTools → Network → WS เห็น `404` วนซ้ำ) | `environment.socketUrl` ฝั่ง frontend ไม่ตรงกับ path prefix จริง | ตรวจ `frontend/src/environments/environment.ts` (dev) หรือ `environment.prod.ts` (production) ให้ `socketUrl` ตรงกับ prefix เดียวกับ `apiBaseUrl` |
| Login ไม่ติด, CORS error ตอนรัน dev | เข้าเว็บผ่านพอร์ตอื่นที่ไม่ใช่ `localhost` (เช่น editor forward พอร์ตให้เองแบบ VS Code) | backend รองรับทุก origin ที่เป็น `localhost`/`127.0.0.1` อัตโนมัติตอน dev อยู่แล้ว (ดู `backend/src/common/utils/cors.util.ts`) — ถ้ายังพบปัญหาให้ตรวจว่า `NODE_ENV` ใน `backend/.env` ไม่ใช่ `production` |
| Login ไม่ติด, CORS error ตอนรัน production | `CORS_ORIGIN` ใน backend ไม่ตรงกับ URL ที่เปิดจริง | แก้ `CORS_ORIGIN` ใน `.env` (root) ให้ตรงกับ origin ของ frontend จริง แล้ว `deploy-prod.bat` ใหม่ |
| QR scan หน้าเว็บใช้งานไม่ได้ | `FRONTEND_BASE_URL` ฝั่ง backend ไม่ตรงกับ URL จริงของ frontend | แก้ `FRONTEND_BASE_URL` แล้ว regenerate QR ใหม่ |
