# 7. Deployment Guide (คู่มือ Deploy ขึ้นระบบจริง)

## 7.1 ข้อกำหนดเบื้องต้นก่อน Deploy จริง

- [ ] เปลี่ยนค่า secret ทั้งหมดใน `.env` (JWT secrets, DB password, QR AES secret) จากค่า default/ตัวอย่าง
- [ ] เปลี่ยนรหัสผ่าน admin ทันทีหลัง deploy (บังคับอยู่แล้วโดยระบบ)
- [ ] ตั้งค่า Gmail SMTP จริง (ดู [docs/06-installation-guide.md](06-installation-guide.md#65-การตั้งค่า-gmail-smtp))
- [ ] เตรียมใบรับรอง TLS/SSL (Let's Encrypt หรือใบรับรองขององค์กร)
- [ ] ตั้งค่า DNS ให้ชี้มายังเซิร์ฟเวอร์ที่รัน Docker
- [ ] วางแผนสำรองข้อมูล (ดูหัวข้อ 7.4)

## 7.2 HTTPS / TLS (HTTPS Ready)

Nginx config ปัจจุบัน (`docker/nginx/nginx.conf`) เปิดรับเฉพาะพอร์ต 80 — สำหรับ production ให้เพิ่ม server block รับ 443:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.go.th;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # ... location block เดิมจาก server 80 ...
}

server {
    listen 80;
    server_name your-domain.go.th;
    return 301 https://$host$request_uri;   # บังคับ redirect ไป HTTPS
}
```

Mount certificate เข้า container ผ่าน `docker-compose.yml`:

```yaml
nginx:
  volumes:
    - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    - /etc/letsencrypt/live/your-domain:/etc/nginx/ssl:ro
  ports:
    - '443:443'
```

ตั้งค่า `CORS_ORIGIN` และ `FRONTEND_BASE_URL` ใน `.env` ให้เป็น `https://your-domain.go.th`

## 7.2b Path Prefix Deployment (`/khd-it-sup/`)

ระบบนี้ถูกออกแบบให้ deploy อยู่ใต้ path prefix คงที่ (ค่า default คือ `/khd-it-sup/`) แทนที่จะอยู่ที่ root domain
เพื่อให้แชร์ domain/server เดียวกับระบบอื่นได้ (path-based multi-tenant) ผ่าน reverse proxy ตัวเดียว —
container ด้านในไม่รู้จัก prefix นี้เลย (nginx ตัดออกก่อน proxy เสมอ)

หากต้องการเปลี่ยน prefix (หรือย้ายไปรันที่ root `/`) ต้องแก้ **4 จุดให้ตรงกัน**:

| ไฟล์ | ค่าที่ต้องแก้ | ตัวอย่างปัจจุบัน |
|---|---|---|
| `.env` (root, ใช้โดย backend) | `FRONTEND_BASE_URL` — ใช้สร้างลิงก์เต็มในอีเมล/LINE/Telegram (ยืนยันบัญชี, ลืมรหัสผ่าน, QR scan) และคำนวณ cookie `Path` ของ refresh token | `FRONTEND_BASE_URL=http://localhost/khd-it-sup` |
| `frontend/angular.json` | `projects.frontend.architect.build.configurations.production.baseHref` | `"baseHref": "/khd-it-sup/"` |
| `frontend/src/environments/environment.prod.ts` | `apiBaseUrl`, `socketUrl` | `apiBaseUrl: '/khd-it-sup/api/v1'`, `socketUrl: '/khd-it-sup/'` |
| `docker/nginx/nginx.conf` | ทุก `location /khd-it-sup/...` block + `rewrite ^/khd-it-sup(/.*)$ $1 break;` | ดูตัวอย่างในไฟล์จริง |

ข้อควรระวัง:

- **`FRONTEND_BASE_URL` ต้องมี path ต่อท้าย ไม่มี trailing slash** (`http://localhost/khd-it-sup` ไม่ใช่ `.../khd-it-sup/`) —
  backend ใช้ `new URL(env.FRONTEND_BASE_URL).pathname` เพื่อคำนวณ cookie path ของ refresh token โดยตรง
- **Socket.IO client ต้องพับ prefix เข้าไปใน `path` option ตรง ๆ** (`path: '/khd-it-sup/socket.io'`) — การส่ง prefix
  ผ่าน connection URL เฉย ๆ จะไม่ทำให้ client ต่อ path ที่ถูกต้อง (ดู [docs/05-api-design.md](05-api-design.md) §5.13
  และ [docs/10-developer-manual.md](10-developer-manual.md) §10.8)
- `baseHref` ใน `angular.json` เป็นค่าเฉพาะ production configuration เท่านั้น — dev server (`ng serve`) ยังรันที่ root ตามปกติ
- ถ้าย้ายไปรันที่ root domain ให้ตั้งทุกค่าข้างต้นเป็น `/` (หรือละ `baseHref`/`apiBaseUrl` prefix) และลบ `rewrite` +
  เปลี่ยน `location /khd-it-sup/...` เป็น `location /...` ใน nginx.conf
- หลังแก้ต้อง rebuild frontend image ใหม่เสมอ (`baseHref`/`environment.prod.ts` ถูก build เข้าไปใน static bundle
  ตอน `ng build --configuration production` ไม่ใช่ runtime config)

## 7.3 Environment Variables (Production Checklist)

| ตัวแปร | คำแนะนำสำหรับ Production |
|---|---|
| `NODE_ENV` | `production` (ตั้งใน docker-compose แล้ว) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | สุ่มใหม่ ≥ 32 ตัวอักษร แยกกันเด็ดขาด ไม่ใช้ค่าเดียวกับ dev |
| `QR_AES_SECRET` | สุ่มใหม่ 32 ตัวอักษรพอดี — **ห้ามเปลี่ยนหลังใช้งานจริงแล้ว** (QR ที่พิมพ์ไปแล้วจะ decrypt ไม่ได้) |
| `CORS_ORIGIN` | domain จริงเท่านั้น ห้ามใช้ `*` |
| `RATE_LIMIT_MAX` / `LOGIN_RATE_LIMIT_MAX` | พิจารณาลดตามปริมาณผู้ใช้จริงเพื่อป้องกัน brute-force |

## 7.4 Backup

### Manual Backup

```bash
docker exec khd_it_sup_db mariadb-dump -u root -p"$MARIADB_ROOT_PASSWORD" khd_it_sup > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Automatic Backup (แนะนำ)

เพิ่ม cron job บนเครื่อง host (ระบบ Backup อัตโนมัติเต็มรูปแบบผ่าน UI อยู่ใน Phase 10+ ตาม roadmap):

```cron
0 2 * * * docker exec khd_it_sup_db mariadb-dump -u root -p"$MARIADB_ROOT_PASSWORD" khd_it_sup | gzip > /backups/khd_$(date +\%Y\%m\%d).sql.gz
```

### Restore

```bash
gunzip -c /backups/khd_20260101.sql.gz | docker exec -i khd_it_sup_db mariadb -u root -p"$MARIADB_ROOT_PASSWORD" khd_it_sup
```

อย่าลืมสำรอง volume `backend-uploads` ด้วย (ไฟล์แนบ/รูปครุภัณฑ์ไม่ได้อยู่ในฐานข้อมูล):

```bash
docker run --rm -v khd-it-sup_backend-uploads:/data -v $(pwd):/backup alpine tar czf /backup/uploads_$(date +%Y%m%d).tar.gz /data
```

## 7.5 Scaling & High Availability (แนวทางสำหรับปริมาณผู้ใช้สูง)

- **Backend**: เป็น stateless (session อยู่ใน JWT) จึงสามารถรันหลาย replica ได้ทันทีด้วย `docker compose up --scale backend=3` ร่วมกับ load balancer ที่รองรับ WebSocket (Socket.IO ต้องใช้ sticky session หรือ Redis adapter หากมีมากกว่า 1 instance)
- **Database**: MariaDB รองรับ replication (primary-replica) สำหรับ read scaling — ต้อง config เพิ่มเติมนอกเหนือจาก docker-compose นี้
- **File storage**: หากขยายเป็นหลายเครื่อง ให้ย้าย `backend/uploads` ไปใช้ shared storage (NFS/S3-compatible) แทน local volume

## 7.6 Monitoring & Logging

- Backend log แบบ structured JSON อยู่ที่ volume `backend-logs` (Winston daily rotate) — ต่อเข้ากับ log aggregator (ELK/Loki) ได้โดยตรง
- Health check endpoint: `GET /health` — ใช้กับ uptime monitoring (UptimeRobot, Healthchecks.io) หรือ orchestrator health probe
- Docker Healthcheck ถูกตั้งค่าไว้แล้วทั้ง backend และ frontend container (`docker compose ps` แสดงสถานะ `healthy`)

## 7.7 CI/CD Recommendation

แนะนำ pipeline ต่อไปนี้ (ยังไม่ได้ implement เป็นไฟล์ `.github/workflows` จริงในโปรเจกต์นี้ — เป็นคำแนะนำสำหรับทีมที่จะนำไปใช้):

```yaml
# ตัวอย่างแนวคิด GitHub Actions (.github/workflows/ci.yml)
name: CI
on: [push, pull_request]
jobs:
  backend-test:
    runs-on: ubuntu-latest
    services:
      mariadb:
        image: mariadb:11
        env:
          MARIADB_ROOT_PASSWORD: test
          MARIADB_DATABASE: khd_it_sup
        ports: ['3306:3306']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: mysql -h 127.0.0.1 -uroot -ptest khd_it_sup < database/schema.sql
      - run: mysql -h 127.0.0.1 -uroot -ptest khd_it_sup < database/seed.sql
      - working-directory: backend
        run: npm ci && npx prisma generate && npm run build && npm test

  frontend-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - working-directory: frontend
        run: npm ci && npx ng build --configuration production

  docker-build:
    needs: [backend-test, frontend-build]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker compose build
      # push ไปยัง registry (ghcr.io / ECR / Docker Hub) ตามนโยบายองค์กร
```

หลักการ: **ทดสอบ backend กับฐานข้อมูลจริง (ไม่ mock)** ตาม unique constraint/trigger ที่ schema.sql กำหนดไว้ (เช่น immutable timeline trigger)
เพื่อให้มั่นใจว่าพฤติกรรมที่ทดสอบใน CI ตรงกับ production จริง
