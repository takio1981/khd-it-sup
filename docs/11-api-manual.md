# 11. API Manual (คู่มือการใช้งาน API)

## 11.1 เอกสารอ้างอิง

| แหล่งข้อมูล | เมื่อไหร่ควรใช้ |
|---|---|
| **Swagger UI** — `http://localhost/api-docs` (หรือ `http://localhost:3000/api-docs` ถ้ารัน backend ตรง) | ทดลองยิง API แบบ interactive, ดู schema แบบ real-time ที่ตรงกับโค้ดจริงเสมอ |
| [docs/05-api-design.md](05-api-design.md) | endpoint inventory ระดับออกแบบ พร้อมสถานะ MVP/Phase 10+ |
| [postman/khd-it-sup.postman_collection.json](../postman/khd-it-sup.postman_collection.json) | import เข้า Postman เพื่อทดสอบทุก endpoint พร้อม script auto-save token |

## 11.2 Authentication Flow

```
1. POST /api/v1/auth/login   { username, password }
   → 200 { data: { accessToken, user } }  + Set-Cookie: khd_refresh_token (httpOnly)

2. ใช้ accessToken แนบทุก request ถัดไป:
   Authorization: Bearer <accessToken>

3. เมื่อ accessToken หมดอายุ (401):
   POST /api/v1/auth/refresh   (ไม่ต้องส่ง body, cookie ส่งอัตโนมัติ)
   → 200 { data: { accessToken ใหม่, user } }

4. POST /api/v1/auth/logout   (revoke refresh token ปัจจุบัน)
```

accessToken มีอายุ 15 นาที (`JWT_ACCESS_EXPIRES_IN`), refreshToken 7 วัน (`JWT_REFRESH_EXPIRES_IN`) — ปรับได้ใน `.env`

## 11.3 รูปแบบ Response มาตรฐาน

```jsonc
// Success
{ "success": true, "data": { ... }, "meta": { "page": 1, "limit": 20, "total": 134 } }

// Error
{ "success": false, "error": { "code": "ASSET_NOT_FOUND", "message": "ไม่พบครุภัณฑ์", "details": [] } }
```

`error.code` เป็นค่าคงที่ (เช่น `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `DUPLICATE_ENTRY`)
ใช้สำหรับเขียน error-handling logic ฝั่ง client ได้โดยไม่ต้อง parse ข้อความภาษาไทย

## 11.4 ตัวอย่าง: Flow การแจ้งซ่อมผ่าน QR ครบวงจร (curl)

```bash
BASE=http://localhost:3000/api/v1

# 1) Login
TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@12345"}' | jq -r '.data.accessToken')

# 2) สร้าง QR ให้ครุภัณฑ์ (ต้องมี asset อยู่แล้ว)
curl -s -X POST $BASE/qrcodes/assets/$ASSET_ID/generate \
  -H "Authorization: Bearer $TOKEN"
# → { data: { qrToken, scanUrl, dataUrl } }

# 3) จำลองการสแกน (public, ไม่ต้อง auth)
curl -s $BASE/qrcodes/resolve/$QR_TOKEN

# 4) แจ้งซ่อม (ต้อง login)
curl -s -X POST $BASE/repair-tickets \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"assetId\":\"$ASSET_ID\",\"description\":\"คอมพิวเตอร์เปิดไม่ติด\",\"urgency\":\"HIGH\"}"
# → { data: { id, ticketNumber, status: "SUBMITTED", ... } }

# 5) IT Officer รับเรื่อง
curl -s -X POST $BASE/repair-tickets/$TICKET_ID/receive -H "Authorization: Bearer $TOKEN"

# 6) เปลี่ยนสถานะไปตามขั้นตอน (ต้องมี transition ที่ถูกต้องเท่านั้น ดู workflow-templates)
curl -s -X POST $BASE/repair-tickets/$TICKET_ID/transition \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"toStepCode":"IT_REVIEW"}'

# 7) ดู Timeline ทั้งหมด
curl -s $BASE/repair-tickets/$TICKET_ID/timeline -H "Authorization: Bearer $TOKEN"
```

## 11.5 Rate Limiting

| ขอบเขต | ค่า default | ปรับได้ที่ |
|---|---|---|
| ทุก request ใต้ `/api/v1` | 300 request / 15 นาที ต่อ IP | `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` |
| `/api/v1/auth/login` | 10 request / 15 นาที ต่อ IP (นับเฉพาะที่ล้มเหลว) | `LOGIN_RATE_LIMIT_MAX` |

เมื่อเกิน limit จะได้ HTTP 429 พร้อม `error.code = "TOO_MANY_REQUESTS"` หรือ `"TOO_MANY_LOGIN_ATTEMPTS"`

## 11.6 Workflow Engine — ข้อควรรู้สำหรับผู้เรียก API

- `POST /repair-tickets/:id/transition` ยอมรับเฉพาะ `toStepCode` ที่มีเส้นทาง (transition) ที่ config ไว้จาก step ปัจจุบันเท่านั้น
  — เรียกผิดจะได้ `409 CONFLICT`
- `toStepCode` เป็น `CLOSED` หรือ `CANCELLED` ผ่าน endpoint นี้โดยตรงจะถูกปฏิเสธ (`400`) — ให้ใช้ `/close` และ `/cancel` แทน
  เพราะมี business rule เพิ่มเติม (เช่น cancel ต้องระบุเหตุผล)
- ดูสถานะ/เส้นทางทั้งหมดที่เป็นไปได้ของ template ปัจจุบันได้จาก `GET /workflow-templates/REPAIR_INTERNAL`
  (field `steps[]` และ `transitions[]`)

## 11.7 File Upload

Endpoint ที่รับไฟล์ (`POST /assets/:id/photos`, `POST /repair-tickets/:id/attachments`) ใช้ `multipart/form-data`
ไม่ใช่ JSON — field name ต้องตรงตามที่ระบุ (`photos` / `attachments`) รองรับหลายไฟล์พร้อมกัน (สูงสุด 10 ไฟล์/ครั้ง)
ชนิดไฟล์ที่รองรับ: JPEG, PNG, WEBP, GIF, PDF (ขนาดสูงสุดต่อไฟล์ปรับได้ที่ `UPLOAD_MAX_FILE_SIZE_MB`)

ไฟล์ที่อัปโหลดแล้วต้องเข้าถึงผ่าน `GET /files/:subdir/:filename` เท่านั้น (ต้อง login) — ไม่มี static URL สาธารณะ
