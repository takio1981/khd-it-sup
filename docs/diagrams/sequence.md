# Sequence Diagrams

Diagram หลัก (สร้างใบแจ้งซ่อม) อยู่ที่ [01-architecture.md § 1.3](../01-architecture.md#ตัวอย่าง-flow-คำขอ-1-ครั้ง-create-repair-ticket)
— ไฟล์นี้เพิ่มเติม flow สำคัญอีก 2 แบบ

## QR Scan → ดูข้อมูลครุภัณฑ์ (Public, ไม่ต้อง login)

```mermaid
sequenceDiagram
    participant U as ผู้ใช้ (มือถือ)
    participant N as Nginx
    participant C as QrCodeController
    participant S as QrCodeService
    participant Crypto as AES Util
    participant R as QrCodeRepository
    participant DB as MariaDB

    U->>N: สแกน QR → GET /qr/scan/:token (frontend route)
    N->>N: serve Angular SPA
    Note over U: Angular เรียก API ต่อ
    U->>N: GET /api/v1/qrcodes/resolve/:token
    N->>C: forward
    C->>S: resolve(token, userId?, ip, ua)
    S->>Crypto: decryptAssetId(token)
    Crypto-->>S: assetId
    S->>R: findQrByToken(token)
    R->>DB: SELECT asset_qrcodes WHERE qr_token = ?
    DB-->>R: qr row (ตรวจ is_active)
    S->>R: findAssetSummaryForScan(assetId)
    R->>DB: SELECT asset + category + repair_tickets (10 ล่าสุด)
    DB-->>R: asset summary
    S->>R: logScan(assetId, userId, ip, ua)
    R->>DB: INSERT qr_scan_logs
    S-->>C: asset summary
    C-->>U: 200 { data: asset summary }
```

## Notification Dispatch (หลัง Ticket Transition สำเร็จ)

```mermaid
sequenceDiagram
    participant TS as RepairTicketService
    participant NS as NotificationService
    participant Repo as NotificationRepository
    participant Mailer as Nodemailer/Gmail SMTP
    participant Socket as Socket.IO
    participant DB as MariaDB

    TS->>TS: applyTransition() commit สำเร็จ
    TS->>NS: notifyTicketEvent(event, ticket, statusLabel)
    NS->>NS: resolveRecipients(event, ticket)
    loop ต่อผู้รับแต่ละคน
        NS->>Repo: create(status=PENDING)
        Repo->>DB: INSERT notification_logs
        NS->>Mailer: sendMail(to, subject, html)
        alt ส่งสำเร็จ
            Mailer-->>NS: messageId
            NS->>Repo: markSent(id)
        else ส่งล้มเหลว
            Mailer-->>NS: error
            NS->>Repo: markFailed(id, error)
        end
        NS->>Socket: emitToUser(userId, 'ticket:notification', payload)
    end
    Note over TS,NS: notifySafe() ครอบไว้ — error ฝั่งแจ้งเตือนไม่ทำให้ transition หลักล้มเหลว
```
