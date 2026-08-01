# 6. Installation Guide (คู่มือติดตั้ง)

## 6.1 Prerequisites

| เครื่องมือ | เวอร์ชันขั้นต่ำ | ใช้สำหรับ |
|---|---|---|
| Docker + Docker Compose | Docker 24+ | รันทั้งระบบแบบ container (แนะนำ) |
| Node.js | 20 LTS | รัน backend/frontend แบบ local dev (ไม่ผ่าน Docker) |
| MariaDB | 10.11+ / 11.x | ฐานข้อมูล (ถ้าไม่ใช้ Docker) |
| Git | ล่าสุด | clone โปรเจกต์ |

---

## 6.2 วิธีที่ 1: ติดตั้งด้วย Docker (แนะนำ — เร็วที่สุด)

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
SMTP_USER / SMTP_PASS          # Gmail App Password (ดูหัวข้อ 6.5)
```

> สร้าง secret แบบสุ่มด้วยคำสั่ง: `node -e "console.log(require('crypto').randomBytes(32).toString('hex').slice(0,32))"`

```bash
# 2) build และรันทั้งระบบ
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

## 6.3 วิธีที่ 2: รัน Local Dev (ไม่ผ่าน Docker) — สำหรับนักพัฒนา

### Database

ติดตั้ง MariaDB แล้วรัน:

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```

### Backend

```bash
cd backend
cp .env.example .env
# แก้ DATABASE_URL ให้ชี้ไปที่ MariaDB ของเครื่องคุณ เช่น
# DATABASE_URL="mysql://root:yourpassword@localhost:3306/khd_it_sup"

npm install
npx prisma generate
npm run dev          # รันที่ http://localhost:3000 พร้อม hot-reload (tsx watch)
```

Swagger UI: `http://localhost:3000/api-docs`

### Frontend

```bash
cd frontend
npm install
npm start            # หรือ npx ng serve — รันที่ http://localhost:4200
```

Frontend (dev) เรียก backend ที่ `http://localhost:3000/api/v1` ตามค่าใน `frontend/src/environments/environment.ts`
แก้ไขไฟล์นี้หาก backend รันที่พอร์ตอื่น

---

## 6.4 การรัน Test

```bash
cd backend
npm test                    # Jest unit + integration tests (ต้องมี MariaDB ที่ apply schema.sql แล้ว)
npm run test:coverage       # พร้อม coverage report
```

---

## 6.5 การตั้งค่า Gmail SMTP (สำหรับแจ้งเตือนทางอีเมล)

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

## 6.5b การตั้งค่า Telegram Bot / LINE Messaging API (ทางเลือก)

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

## 6.6 Troubleshooting

| อาการ | สาเหตุที่เป็นไปได้ | วิธีแก้ |
|---|---|---|
| เข้า `http://localhost` แล้วได้ 404 | ปกติ — ระบบตั้งใจให้ต้องเข้าผ่าน path prefix `/khd-it-sup/` เสมอ | เข้า `http://localhost/khd-it-sup/` แทน |
| `docker compose up` ค้างที่ mariadb | พอร์ต 3306 ถูกใช้งานอยู่แล้วบนเครื่อง | เปลี่ยน `MARIADB_PORT` ใน `.env` |
| Backend error `Environment variable not found: DATABASE_URL` | ยังไม่ได้สร้างไฟล์ `.env` | `cp backend/.env.example backend/.env` แล้วแก้ค่า |
| Prisma error เรื่อง `libssl`/OpenSSL บน Alpine | ปกติมีการติดตั้ง `openssl` และตั้ง `binaryTargets` ไว้ใน `schema.prisma` แล้ว หากยังพบปัญหาให้ตรวจสอบว่า build image ใหม่ล่าสุด | `docker compose build --no-cache backend` |
| `502 Bad Gateway` หลัง `docker compose up -d backend` (recreate เฉพาะ container backend/frontend) | Nginx cache IP ของ container เดิมไว้ตอน resolve DNS ครั้งแรก พอ container ถูก recreate จะได้ IP ใหม่แต่ nginx ยังชี้ IP เก่าอยู่ | `docker compose restart nginx` ทุกครั้งหลัง recreate backend หรือ frontend |
| กระดิ่งแจ้งเตือน/Socket.IO ไม่เชื่อมต่อ (เช็คได้จาก DevTools → Network → WS เห็น `404` วนซ้ำ) | `environment.socketUrl` ฝั่ง frontend ไม่ตรงกับ path prefix จริง | ตรวจ `frontend/src/environments/environment.prod.ts` ให้ `socketUrl` ตรงกับ prefix เดียวกับ `apiBaseUrl` |
| Login ไม่ติด, CORS error | `CORS_ORIGIN` ใน backend ไม่ตรงกับ URL ที่เปิดจริง | แก้ `CORS_ORIGIN` ให้ตรงกับ origin ของ frontend |
| QR scan หน้าเว็บใช้งานไม่ได้ | `FRONTEND_BASE_URL` ฝั่ง backend ไม่ตรงกับ URL จริงของ frontend | แก้ `FRONTEND_BASE_URL` แล้ว regenerate QR ใหม่ |
