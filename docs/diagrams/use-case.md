# Use Case Diagram

ครอบคลุมเฉพาะ use case ที่ implement แล้ว (Phase 1-8) — เครื่องหมาย 🔜 คือ Phase 10+

```mermaid
flowchart LR
    Guest((ผู้ใช้ทั่วไป<br/>ไม่ login))
    User((User))
    Technician((Technician))
    ITOfficer((IT Officer))
    Admin((Admin))
    SuperAdmin((Super Admin))

    subgraph QR[" "]
        UC1(สแกน QR ดูข้อมูลครุภัณฑ์)
    end
    Guest --> UC1

    subgraph Ticket["งานแจ้งซ่อม"]
        UC2(แจ้งซ่อม)
        UC3(ติดตามสถานะงานของตนเอง)
        UC4(เพิ่มความคิดเห็น/แนบไฟล์)
        UC5(รับเรื่องแจ้งซ่อม)
        UC6(มอบหมายช่าง)
        UC7(ปรับสถานะงานซ่อม)
        UC8(ยกเลิกงาน)
        UC9(ปิดงาน)
    end
    User --> UC2
    User --> UC3
    User --> UC4
    Technician --> UC4
    Technician --> UC7
    ITOfficer --> UC5
    ITOfficer --> UC6
    ITOfficer --> UC7
    ITOfficer --> UC8
    ITOfficer --> UC9

    subgraph Asset["ครุภัณฑ์"]
        UC10(ดูรายการ/รายละเอียดครุภัณฑ์)
        UC11(สร้าง/แก้ไข/ลบครุภัณฑ์)
        UC12(สร้าง/พิมพ์ QR Code)
        UC13(ดูประวัติการซ่อม)
    end
    User --> UC10
    User --> UC13
    ITOfficer --> UC10
    ITOfficer --> UC12
    Admin --> UC11
    Admin --> UC12

    subgraph Admin_UC["บริหารระบบ"]
        UC14(จัดการผู้ใช้งาน)
        UC15(จัดการหน่วยงาน)
        UC16(ดูแดชบอร์ด/รายงาน)
        UC17(ตั้งค่า Workflow 🔜)
        UC18(ดู Audit Log 🔜)
    end
    Admin --> UC14
    Admin --> UC15
    Admin --> UC16
    ITOfficer --> UC16
    SuperAdmin --> UC17
    SuperAdmin --> UC18
    SuperAdmin --> UC14
    SuperAdmin --> UC15
```

## คำอธิบาย Actor

| Actor | สิทธิ์โดยสรุป |
|---|---|
| Guest | สแกน QR ดูข้อมูลครุภัณฑ์ได้โดยไม่ต้อง login |
| User | แจ้งซ่อม, ติดตามงานของตนเอง, ดูครุภัณฑ์/ประวัติ |
| Technician | ปรับสถานะงานซ่อม, แนบไฟล์/รูปก่อน-หลังซ่อม |
| IT Officer | รับเรื่อง, มอบหมายช่าง, ปรับสถานะ, ดูแดชบอร์ด |
| Admin | ทุกอย่างของ IT Officer + จัดการครุภัณฑ์/ผู้ใช้/หน่วยงานเต็มรูปแบบ |
| Super Admin | ทุกอย่าง รวมถึงการตั้งค่าระบบและฟีเจอร์ Phase 10+ |
