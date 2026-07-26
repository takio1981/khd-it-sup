# 4. ER Diagram

ที่มา DDL จริง: [`database/schema.sql`](../database/schema.sql)

```mermaid
erDiagram
    ROLES ||--o{ ROLE_PERMISSIONS : has
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : grants
    ROLES ||--o{ USERS : assigned_to
    DEPARTMENTS ||--o{ USERS : belongs_to
    POSITIONS ||--o{ USERS : holds
    DEPARTMENTS ||--o{ DEPARTMENTS : parent_of
    USERS ||--o{ REFRESH_TOKENS : owns
    USERS ||--o{ PASSWORD_RESET_TOKENS : owns

    BUILDINGS ||--o{ FLOORS : contains
    FLOORS ||--o{ ROOMS : contains

    ASSET_CATEGORIES ||--o{ ASSETS : classifies
    DEPARTMENTS ||--o{ ASSETS : owns
    BUILDINGS ||--o{ ASSETS : located_at
    FLOORS ||--o{ ASSETS : located_at
    ROOMS ||--o{ ASSETS : located_at
    VENDORS ||--o{ ASSETS : supplied_by
    USERS ||--o{ ASSETS : owner
    ASSETS ||--o{ ASSET_PHOTOS : has
    ASSETS ||--|| ASSET_QRCODES : has
    ASSETS ||--o{ QR_SCAN_LOGS : scanned

    WORKFLOW_TEMPLATES ||--o{ WORKFLOW_STEPS : defines
    WORKFLOW_TEMPLATES ||--o{ WORKFLOW_TRANSITIONS : defines
    WORKFLOW_STEPS ||--o{ WORKFLOW_TRANSITIONS : from
    WORKFLOW_STEPS ||--o{ WORKFLOW_TRANSITIONS : to
    WORKFLOW_TEMPLATES ||--o{ WORKFLOW_INSTANCES : instantiates
    WORKFLOW_STEPS ||--o{ WORKFLOW_INSTANCES : current_step
    ROLES ||--o{ WORKFLOW_STEPS : responsible

    ASSETS ||--o{ REPAIR_TICKETS : reported_for
    USERS ||--o{ REPAIR_TICKETS : reports
    DEPARTMENTS ||--o{ REPAIR_TICKETS : from_dept
    USERS ||--o{ REPAIR_TICKETS : assigned_technician
    WORKFLOW_INSTANCES ||--|| REPAIR_TICKETS : drives
    REPAIR_TICKETS ||--o{ REPAIR_TICKET_ATTACHMENTS : has
    REPAIR_TICKETS ||--o{ REPAIR_TICKET_TIMELINE : records
    USERS ||--o{ REPAIR_TICKET_TIMELINE : actor
    REPAIR_TICKETS ||--o{ APPROVALS : requires
    WORKFLOW_STEPS ||--o{ APPROVALS : at_step
    USERS ||--o{ APPROVALS : approves

    SPARE_PARTS ||--o{ SPARE_PART_TRANSACTIONS : moves
    REPAIR_TICKETS ||--o{ SPARE_PART_TRANSACTIONS : consumes

    VENDORS ||--o{ VENDOR_REPAIR_ORDERS : fulfills
    REPAIR_TICKETS ||--o{ VENDOR_REPAIR_ORDERS : sent_to_vendor

    REPAIR_TICKETS ||--o{ GENERATED_DOCUMENTS : produces

    USERS ||--o{ AUDIT_LOGS : performs

    USERS {
        char36 id PK
        varchar username UK
        varchar email UK
        varchar password_hash
        varchar full_name
        char36 role_id FK
        char36 department_id FK
        tinyint is_active
        datetime deleted_at
    }

    ROLES {
        char36 id PK
        varchar code UK
        varchar name_th
        tinyint is_system
    }

    PERMISSIONS {
        char36 id PK
        varchar code UK
        varchar module
    }

    ASSETS {
        char36 id PK
        varchar asset_number UK
        varchar gov_asset_number
        varchar serial_number
        char36 category_id FK
        char36 department_id FK
        enum status
        datetime deleted_at
    }

    ASSET_QRCODES {
        char36 id PK
        char36 asset_id FK, UK
        varchar qr_token UK
        tinyint is_active
    }

    REPAIR_TICKETS {
        char36 id PK
        varchar ticket_number UK
        char36 asset_id FK
        char36 reported_by_user_id FK
        varchar status
        char36 workflow_instance_id FK
        char36 assigned_technician_id FK
    }

    REPAIR_TICKET_TIMELINE {
        char36 id PK
        char36 ticket_id FK
        datetime event_time
        varchar event_type
        varchar previous_status
        varchar current_status
        char36 responsible_user_id FK
        enum approval_result
        int elapsed_seconds
        int sla_remaining_seconds
    }

    WORKFLOW_TEMPLATES {
        char36 id PK
        varchar code
        enum applies_to
        int version
    }

    WORKFLOW_STEPS {
        char36 id PK
        char36 template_id FK
        varchar step_code
        int step_order
        char36 responsible_role_id FK
        int sla_hours
        varchar color_code
    }

    WORKFLOW_INSTANCES {
        char36 id PK
        char36 template_id FK
        char36 entity_id
        char36 current_step_id FK
        enum status
    }

    APPROVALS {
        char36 id PK
        char36 ticket_id FK
        char36 workflow_step_id FK
        char36 approver_user_id FK
        enum result
    }

    AUDIT_LOGS {
        char36 id PK
        char36 user_id FK
        varchar action
        varchar module
        json before_data
        json after_data
    }
```

## หมายเหตุ

- แผนภาพนี้ครอบคลุมทุกตารางใน [`database/schema.sql`](../database/schema.sql) ยกเว้นตารางที่ไม่กระทบความสัมพันธ์หลัก
  (`system_settings`, `running_number_sequences`, `backup_logs`, `notification_logs`, `document_templates` — เป็น
  standalone/lookup table ไม่มี FK ขาเข้าสำคัญ)
- ความสัมพันธ์ `ASSETS ||--|| ASSET_QRCODES` เป็น 1:1 (1 ครุภัณฑ์ = 1 QR Code ที่ active ในเวลาหนึ่ง)
- `REPAIR_TICKET_TIMELINE` และ `AUDIT_LOGS` เป็นปลายทางแบบ insert-only เท่านั้น (ไม่มีความสัมพันธ์ที่ลบ cascade ย้อนกลับ)
