# Flowchart — Repair Workflow

## Internal Repair (✅ Implemented — `workflow_templates.code = 'REPAIR_INTERNAL'`)

ตรงกับข้อมูลจริงใน `database/seed.sql` (workflow_steps + workflow_transitions) — ทดสอบ lifecycle เต็มแล้ว (ดู [00-roadmap.md](../00-roadmap.md))

```mermaid
flowchart TD
    Start([ผู้ใช้แจ้งซ่อม]) --> Submitted[แจ้งซ่อมแล้ว<br/>SUBMITTED — SLA 2 ชม.]
    Submitted --> Received[รับเรื่องแล้ว<br/>RECEIVED — SLA 4 ชม.]
    Received --> ITReview[ตรวจสอบเบื้องต้น<br/>IT_REVIEW — SLA 8 ชม.]
    ITReview --> Diagnosis[วิเคราะห์ปัญหา<br/>DIAGNOSIS — SLA 24 ชม.]

    Diagnosis -- NEED_PARTS --> WaitingParts[รออะไหล่<br/>WAITING_PARTS]
    Diagnosis -- READY_REPAIR --> Repairing[กำลังซ่อม<br/>REPAIRING — SLA 48 ชม.]
    WaitingParts --> Repairing

    Repairing --> Testing[ทดสอบระบบ<br/>TESTING — SLA 8 ชม.]
    Testing --> Completed[ซ่อมเสร็จสิ้น<br/>COMPLETED — SLA 4 ชม.]
    Completed --> Returned[คืนอุปกรณ์แล้ว<br/>RETURNED — SLA 24 ชม.]
    Returned --> UserAcceptance[ผู้แจ้งรับมอบ<br/>USER_ACCEPTANCE — SLA 48 ชม. — ต้อง approval]
    UserAcceptance --> Closed([ปิดงาน<br/>CLOSED])

    Submitted -. CANCEL .-> Cancelled([ยกเลิก<br/>CANCELLED])
    Received -. CANCEL .-> Cancelled
    ITReview -. CANCEL .-> Cancelled

    classDef terminal fill:#166534,color:#fff,stroke:none
    classDef cancel fill:#EF4444,color:#fff,stroke:none
    class Closed terminal
    class Cancelled cancel
```

**กฎสำคัญ**: การเปลี่ยนสถานะทุกครั้งต้องผ่าน `WorkflowService.transition()` ซึ่งตรวจสอบว่ามีเส้นทาง (edge) ที่ config
ไว้ใน `workflow_transitions` จริงเท่านั้น — เรียกข้ามขั้นตอน (เช่น SUBMITTED → CLOSED ตรง ๆ) จะถูกปฏิเสธด้วย `409 CONFLICT`
เสมอ (ดู [11-api-manual.md § 11.6](../11-api-manual.md#116-workflow-engine--ข้อควรรู้สำหรับผู้เรียก-api))

---

## External Repair (🔜 Phase 10+ — ออกแบบไว้แล้ว ยังไม่ implement)

Flow ที่วางแผนไว้ตามสเปกข้อ 37/38 — ตารางฐานข้อมูลรองรับแล้ว (`vendor_repair_orders`, `approvals`) แต่ยังไม่มี
`workflow_templates` row สำหรับ `REPAIR_EXTERNAL` และยังไม่มี Service/Controller/UI รองรับ

```mermaid
flowchart TD
    Decision{Diagnosis: ซ่อมภายใน<br/>หรือส่งภายนอก?} -- ส่งภายนอก --> QuoteReq[ขอใบเสนอราคา]
    QuoteReq --> QuoteRecv[ได้รับใบเสนอราคา]
    QuoteRecv --> DeptApproval[อนุมัติโดยหน่วยงาน]
    DeptApproval --> ITManagerApproval[อนุมัติโดยหัวหน้าไอที]
    ITManagerApproval --> FinanceApproval[อนุมัติโดยการเงิน]
    FinanceApproval --> DirectorApproval[อนุมัติโดยผู้อำนวยการ]
    DirectorApproval --> Purchase[ดำเนินการจัดซื้อ]
    Purchase --> VendorAssign[มอบหมายผู้รับซ่อม]
    VendorAssign --> Sent[ส่งอุปกรณ์]
    Sent --> VendorRepair[ผู้รับซ่อมดำเนินการ]
    VendorRepair --> Returned2[รับอุปกรณ์คืน]
    Returned2 --> Inspection[ตรวจรับ]
    Inspection --> Completed2[ซ่อมเสร็จสิ้น]
    Completed2 --> ReturnUser[คืนอุปกรณ์ให้ผู้ใช้]
    ReturnUser --> Accept2[ผู้แจ้งรับมอบ]
    Accept2 --> Closed2([ปิดงาน])

    classDef pending fill:#F97316,color:#fff,stroke:none
    class DeptApproval,ITManagerApproval,FinanceApproval,DirectorApproval pending
```

## Document Workflow ที่เกี่ยวข้อง (🔜 Phase 10+)

เอกสารราชการ 14 ประเภทตามสเปกข้อ 38 (ใบแจ้งซ่อม → ใบรับแจ้งซ่อม → ... → ปิดงาน) จะถูกสร้างอัตโนมัติที่แต่ละจุดของ
External Repair Flow ด้านบน โดยใช้ตาราง `document_templates`/`generated_documents` ที่มีอยู่แล้วในฐานข้อมูล
