import { ChangeDetectionStrategy, Component, inject, signal, effect } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ThemeService, type ThemeMode } from '../../core/services/theme.service';

interface IWorkflowSection {
  key: string;
  title: string;
  icon: string;
  iconColor: string;
  description: string;
  notes: string[];
  /** ผัง mermaid flowchart — เว้นว่างสำหรับหัวข้อที่แสดงเป็นตาราง (เช่น บทบาทและสิทธิ์) แทนผังงาน */
  definition?: string;
}

/** บทบาทและสิทธิ์การใช้งาน — แสดงเป็นตารางเปรียบเทียบแทนผังงาน เพราะเป็นข้อมูลเชิงโครงสร้าง ไม่ใช่ลำดับขั้นตอน */
interface IRoleMatrixRow {
  role: string;
  viewTickets: string;
  editTickets: string;
  adminAccess: string;
}

const OVERVIEW_DIAGRAM = `flowchart TD
  QR(["ผู้ใช้งานสแกน QR Code<br/>บนตัวครุภัณฑ์"])
  ASSETDB[("ฐานข้อมูลครุภัณฑ์")]
  MOPH[/"นำเข้าเอง หรือซิงค์อัตโนมัติ<br/>จาก MOPH AssetTracker (ทุกวัน 02:00 น.)"/]
  RESOLVE["ตรวจสอบ QR + สถานะครุภัณฑ์<br/>+ งานแจ้งซ่อม/ยืมที่ค้างอยู่"]
  TICKET["ระบบงานแจ้งซ่อม"]
  LOAN["ระบบยืม-คืนครุภัณฑ์"]
  PARTS[("คลังอะไหล่")]
  VENDOR["ผู้ขาย/ผู้รับซ่อมภายนอก"]
  DOC["ออกเอกสารราชการ (PDF)"]
  NOTI["ระบบแจ้งเตือนหลายช่องทาง"]
  AUDIT[("ประวัติการใช้งานระบบ (Audit Log)")]

  MOPH e1@--> ASSETDB
  ASSETDB e2@-->|"ออก QR Code"| QR
  QR e3@--> RESOLVE
  RESOLVE e4@-->|"แจ้งซ่อม"| TICKET
  RESOLVE e5@-->|"ยืม/คืน"| LOAN
  TICKET e6@-->|"เบิก/จองอะไหล่"| PARTS
  TICKET e7@-->|"เกินขีดความสามารถซ่อมเอง"| VENDOR
  VENDOR e8@-->|"รับเครื่องคืน"| TICKET
  TICKET e9@-->|"ออกใบแจ้งซ่อม/ใบส่งซ่อม"| DOC
  TICKET -.->|"ทุกการเปลี่ยนสถานะ"| NOTI
  LOAN -.->|"ยืม/คืนสำเร็จ"| NOTI
  TICKET -.-> AUDIT
  LOAN -.-> AUDIT
  PARTS -.-> AUDIT
  VENDOR -.-> AUDIT
  ASSETDB -.-> AUDIT
  e1@{ animate: true }
  e2@{ animate: true }
  e3@{ animate: true }
  e4@{ animate: true }
  e5@{ animate: true }
  e6@{ animate: true }
  e7@{ animate: true }
  e8@{ animate: true }
  e9@{ animate: true }`;

const TICKET_DIAGRAM = `flowchart TD
  START(["ผู้ใช้แจ้งซ่อม<br/>(สแกน QR หรือหน้าเว็บ)"])
  DUPCHECK{"ครุภัณฑ์นี้มีใบแจ้งซ่อม<br/>ที่ยังไม่ปิดงานอยู่แล้วหรือไม่?"}
  BLOCK(["ระบบบล็อกการแจ้งซ้ำ<br/>แสดงเลขที่ใบเดิม + สถานะล่าสุด"])
  SUBMITTED["แจ้งซ่อมแล้ว (SUBMITTED)<br/>ออกเลขที่ใบอัตโนมัติ + แจ้งเตือนไอที"]
  RECEIVED["รับเรื่องแล้ว (RECEIVED)"]
  REVIEW["ตรวจสอบเบื้องต้น (IT_REVIEW)"]
  ASSIGN[/"มอบหมายช่างเทคนิคผู้รับผิดชอบ<br/>(ทำได้ทุกขั้นตอน)"/]
  DIAG["วิเคราะห์ปัญหา (DIAGNOSIS)"]
  OUTCOME{"ผลตรวจสอบ?"}
  PARTS["รออะไหล่ (WAITING_PARTS)"]
  REPAIRING["กำลังซ่อม (REPAIRING)"]
  VENDOR["ส่งซ่อมภายนอก (VENDOR_REPAIR)<br/>ดูผัง SOP ส่งซ่อมภายนอก"]
  TESTING["ทดสอบระบบ (TESTING)"]
  COMPLETED["ซ่อมเสร็จสิ้น (COMPLETED)<br/>บันทึกสรุปผลการซ่อม (สาเหตุ/วิธีซ่อม)"]
  RETURNED["คืนอุปกรณ์แล้ว (RETURNED)"]
  ACCEPT["ผู้แจ้งรับมอบ (USER_ACCEPTANCE)"]
  CLOSED(["ปิดงาน (CLOSED)"])
  CANCELLED(["ยกเลิก (CANCELLED)"])
  SIGN1[/"หัวหน้างาน/กลุ่มงานผู้แจ้ง<br/>ลงนามรับทราบ (ไม่บังคับ ไม่กันขั้นตอน)"/]
  SIGN2[/"หัวหน้ากลุ่มงานสุขภาพดิจิทัล<br/>ลงนามรับรองผล (ไม่บังคับ ไม่กันขั้นตอน)"/]

  START e1@--> DUPCHECK
  DUPCHECK e2@-->|"มี"| BLOCK
  DUPCHECK e3@-->|"ไม่มี"| SUBMITTED
  SUBMITTED e4@-->|"ไอทีรับเรื่อง"| RECEIVED
  RECEIVED e5@-->|"ตรวจสอบเบื้องต้น"| REVIEW
  REVIEW e6@--> DIAG
  RECEIVED -.-> ASSIGN
  SUBMITTED -.-> SIGN1
  DIAG e7@--> OUTCOME
  OUTCOME e8@-->|"ซ่อมได้ทันที"| REPAIRING
  OUTCOME e9@-->|"ต้องรออะไหล่"| PARTS
  OUTCOME e10@-->|"เกินขีดความสามารถ"| VENDOR
  DIAG -.-> SIGN2
  PARTS e11@-->|"อะไหล่พร้อม"| REPAIRING
  REPAIRING e12@-->|"ซ่อมเสร็จ"| TESTING
  VENDOR e13@-->|"รับเครื่องคืนจากร้าน"| TESTING
  TESTING e14@-->|"ทดสอบผ่าน"| COMPLETED
  COMPLETED e15@-->|"คืนอุปกรณ์ให้ผู้ใช้"| RETURNED
  RETURNED e16@-->|"ผู้ใช้ตรวจรับ"| ACCEPT
  ACCEPT e17@-->|"ปิดงาน"| CLOSED
  SUBMITTED -.->|"ยกเลิก"| CANCELLED
  RECEIVED -.->|"ยกเลิก"| CANCELLED
  REVIEW -.->|"ยกเลิก"| CANCELLED
  VENDOR -.->|"ยกเลิก"| CANCELLED
  e1@{ animate: true }
  e2@{ animate: true }
  e3@{ animate: true }
  e4@{ animate: true }
  e5@{ animate: true }
  e6@{ animate: true }
  e7@{ animate: true }
  e8@{ animate: true }
  e9@{ animate: true }
  e10@{ animate: true }
  e11@{ animate: true }
  e12@{ animate: true }
  e13@{ animate: true }
  e14@{ animate: true }
  e15@{ animate: true }
  e16@{ animate: true }
  e17@{ animate: true }`;

const LOAN_DIAGRAM = `flowchart TD
  START(["สแกน QR หรือเลือกครุภัณฑ์ที่ต้องการยืม"])
  CHECK{"ครุภัณฑ์นี้ถูกยืมอยู่แล้วหรือไม่?"}
  BLOCK(["ระบบบล็อก + แสดงชื่อผู้ยืมปัจจุบัน"])
  FORM[/"กรอกวัตถุประสงค์ / กำหนดคืน / สภาพตอนยืม"/]
  BORROWED["กำลังยืม (BORROWED)<br/>แจ้งเตือนผู้ยืม + เจ้าหน้าที่ไอที"]
  NOTE1[/"เกินวันกำหนดคืน → ระบบคำนวณและแสดงป้าย<br/>'เกินกำหนดคืน' ให้ทันที โดยไม่ต้องมีคนกดเปลี่ยนสถานะ"/]
  RETURNFORM[/"กรอกสภาพตอนคืน"/]
  RETURNED(["คืนแล้ว (RETURNED)<br/>แจ้งเตือนคืนสำเร็จ"])

  START e1@--> CHECK
  CHECK e2@-->|"ถูกยืมอยู่"| BLOCK
  CHECK e3@-->|"ว่าง"| FORM
  FORM e4@--> BORROWED
  BORROWED -.-> NOTE1
  BORROWED e5@-->|"คืนอุปกรณ์"| RETURNFORM
  RETURNFORM e6@--> RETURNED
  e1@{ animate: true }
  e2@{ animate: true }
  e3@{ animate: true }
  e4@{ animate: true }
  e5@{ animate: true }
  e6@{ animate: true }`;

const VENDOR_DIAGRAM = `flowchart TD
  TRIGGER(["ผลตรวจสอบเบื้องต้น = ส่งซ่อมภายนอก<br/>(จากผัง SOP งานแจ้งซ่อม)"])
  CREATE["สร้างใบส่งซ่อมภายนอก<br/>เลือกผู้รับซ่อม (Vendor)"]
  QREQ["ขอใบเสนอราคา (QUOTATION_REQUESTED)"]
  QREC["ได้รับใบเสนอราคา (QUOTATION_RECEIVED)"]
  APPROVED["อนุมัติราคา (APPROVED)"]
  PO["ออกเลขที่ใบสั่งซ่อมอัตโนมัติ (PO_GENERATED)"]
  SENT["ส่งเครื่องให้ผู้รับซ่อมแล้ว (SENT)"]
  INREPAIR["อยู่ระหว่างซ่อม (IN_REPAIR)"]
  RETURNED["รับเครื่องคืนจากร้าน (RETURNED)"]
  AUTOBACK[/"ระบบย้ายใบแจ้งซ่อมต้นทาง<br/>กลับเข้าสถานะ 'ทดสอบระบบ' ให้อัตโนมัติ"/]
  INSPECTED["ตรวจสอบเครื่องที่ได้คืน (INSPECTED)"]
  COMPLETED(["เสร็จสิ้น (COMPLETED)"])

  TRIGGER e1@--> CREATE e2@--> QREQ e3@--> QREC e4@--> APPROVED e5@--> PO e6@--> SENT e7@--> INREPAIR e8@--> RETURNED
  RETURNED -.-> AUTOBACK
  RETURNED e9@--> INSPECTED e10@--> COMPLETED
  e1@{ animate: true }
  e2@{ animate: true }
  e3@{ animate: true }
  e4@{ animate: true }
  e5@{ animate: true }
  e6@{ animate: true }
  e7@{ animate: true }
  e8@{ animate: true }
  e9@{ animate: true }
  e10@{ animate: true }`;

const PARTS_DIAGRAM = `flowchart TD
  PART[("รายการอะไหล่ (รหัส/ชื่อ/จำนวนคงเหลือ)")]
  TYPE{"ประเภทธุรกรรม?"}
  RECEIVE["รับเข้า / ซื้อเข้าใหม่ / รับคืน<br/>(RECEIVE / PURCHASE / RETURN)"]
  OUT["จอง / เบิกใช้<br/>(RESERVE / ISSUE)"]
  ADJUST["ปรับยอดให้ตรงของจริง (ADJUST)"]
  STOCKCHECK{"สต็อกเพียงพอหรือไม่?"}
  REJECT(["ระบบปฏิเสธ<br/>แจ้งจำนวนคงเหลือจริง"])
  LINK[/"ผูกกับใบแจ้งซ่อม (ถ้ามี)"/]
  DONE(["บันทึกยอดคงเหลือใหม่ + ประวัติธุรกรรม"])

  PART e1@--> TYPE
  TYPE e2@-->|"เพิ่มยอด"| RECEIVE e3@--> DONE
  TYPE e4@-->|"ลดยอด"| OUT e5@--> STOCKCHECK
  STOCKCHECK e6@-->|"ไม่พอ"| REJECT
  STOCKCHECK e7@-->|"พอ"| LINK e8@--> DONE
  TYPE e9@-->|"ปรับยอดตรง ๆ"| ADJUST e10@--> DONE
  e1@{ animate: true }
  e2@{ animate: true }
  e3@{ animate: true }
  e4@{ animate: true }
  e5@{ animate: true }
  e6@{ animate: true }
  e7@{ animate: true }
  e8@{ animate: true }
  e9@{ animate: true }
  e10@{ animate: true }`;

const NOTIFICATION_DIAGRAM = `flowchart TD
  EVENT{"เหตุการณ์ในระบบ<br/>(แจ้งซ่อมใหม่ / เปลี่ยนสถานะ / มอบหมายช่าง / ยืม-คืน ฯลฯ)"}
  ROUTE["ระบบแจ้งเตือนกลาง<br/>คัดเลือกผู้รับตามบทบาท/สิทธิ์ที่เกี่ยวข้อง"]
  EMAIL["อีเมล"]
  TG["Telegram (กลุ่มกลาง + ส่วนตัว)"]
  LINE["LINE (กลุ่มกลาง + ส่วนตัว)"]
  PUSH["แจ้งเตือนในระบบ (กระดิ่ง)<br/>+ อัปเดตแบบเรียลไทม์ (Socket.IO)"]
  LOG[("บันทึกประวัติการแจ้งเตือน<br/>ทุกช่องทาง ทั้งสำเร็จและล้มเหลว")]

  EVENT e1@--> ROUTE
  ROUTE e2@--> EMAIL e3@--> LOG
  ROUTE e4@--> TG e5@--> LOG
  ROUTE e6@--> LINE e7@--> LOG
  ROUTE e8@--> PUSH e9@--> LOG
  e1@{ animate: true }
  e2@{ animate: true }
  e3@{ animate: true }
  e4@{ animate: true }
  e5@{ animate: true }
  e6@{ animate: true }
  e7@{ animate: true }
  e8@{ animate: true }
  e9@{ animate: true }`;

const ASSET_DIAGRAM = `flowchart TD
  MANUAL[/"เจ้าหน้าที่กรอกข้อมูลครุภัณฑ์เอง"/]
  MOPH[/"ซิงค์อัตโนมัติทุกวัน 02:00 น. หรือกดนำเข้าเอง<br/>จาก MOPH AssetTracker"/]
  CHECKDUP{"เลขครุภัณฑ์ราชการ<br/>ตรงกับรายการเดิมที่นำเข้าไว้แล้วหรือไม่?"}
  UPDATE["อัปเดตข้อมูลที่เปลี่ยนแปลงได้<br/>(ไม่ทับหมวดหมู่/หน่วยงานที่แก้ไขไว้ภายหลัง)"]
  CREATE[("บันทึกครุภัณฑ์ใหม่ในระบบ")]
  QR["ออก QR Code (ลิงก์แบบสั้น)"]
  PRINT["พิมพ์ป้าย QR ติดที่ตัวเครื่อง"]
  SCAN(["ผู้ใช้งานสแกน QR"])
  RESOLVE["ตรวจสอบ token + สถานะครุภัณฑ์<br/>+ งานแจ้งซ่อม/ยืมที่ค้างอยู่"]
  ACTION{"ต้องการทำอะไร?"}
  TICKETFLOW(["ไปที่ผัง SOP งานแจ้งซ่อม"])
  LOANFLOW(["ไปที่ผัง SOP ยืม-คืนครุภัณฑ์"])

  MANUAL e1@--> CREATE
  MOPH e2@--> CHECKDUP
  CHECKDUP e3@-->|"ตรง (นำเข้าซ้ำ)"| UPDATE
  CHECKDUP e4@-->|"ไม่ตรง (รายการใหม่)"| CREATE
  CREATE e5@--> QR e6@--> PRINT e7@--> SCAN e8@--> RESOLVE e9@--> ACTION
  ACTION e10@-->|"แจ้งซ่อม"| TICKETFLOW
  ACTION e11@-->|"ยืม/คืน"| LOANFLOW
  e1@{ animate: true }
  e2@{ animate: true }
  e3@{ animate: true }
  e4@{ animate: true }
  e5@{ animate: true }
  e6@{ animate: true }
  e7@{ animate: true }
  e8@{ animate: true }
  e9@{ animate: true }
  e10@{ animate: true }
  e11@{ animate: true }`;

const DOCUMENT_DIAGRAM = `flowchart TD
  START(["เลือกใบแจ้งซ่อม + เลือกแบบฟอร์มเอกสาร"])
  RENDER["เบราว์เซอร์สร้างไฟล์ PDF<br/>จากข้อมูลบนหน้าจอ (ฝั่งผู้ใช้งาน)"]
  UPLOAD["อัปโหลดไฟล์ PDF ขึ้นเซิร์ฟเวอร์"]
  RUNNO["ออกเลขที่เอกสารอัตโนมัติ<br/>ตามลำดับรันของแบบฟอร์มนั้น"]
  SAVE[("บันทึกประวัติเอกสารที่ออกแล้ว ผูกกับใบแจ้งซ่อม")]
  DONE(["ดาวน์โหลด/พิมพ์เอกสารได้ทันที"])

  START e1@--> RENDER e2@--> UPLOAD e3@--> RUNNO e4@--> SAVE e5@--> DONE
  e1@{ animate: true }
  e2@{ animate: true }
  e3@{ animate: true }
  e4@{ animate: true }
  e5@{ animate: true }`;

@Component({
  selector: 'khd-workflow-diagrams',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatTabsModule, MatProgressSpinnerModule, IconComponent],
  templateUrl: './workflow-diagrams.component.html',
  styleUrl: './workflow-diagrams.component.scss',
})
export class WorkflowDiagramsComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly themeService = inject(ThemeService);

  readonly loading = signal(true);
  readonly renderError = signal<string | null>(null);
  private readonly svgByKey = signal<Record<string, SafeHtml>>({});

  readonly overview: IWorkflowSection = {
    key: 'overview',
    title: 'ภาพรวมการเชื่อมโยงและการส่งข้อมูลระหว่างระบบ',
    icon: 'share',
    iconColor: 'text-brand-primary dark:text-emerald-400',
    description:
      'ทุกระบบเชื่อมกันผ่านครุภัณฑ์และ QR Code เป็นจุดศูนย์กลาง — สแกนแล้วระบบจะตรวจสอบสถานะและงานค้างก่อนพาไปยังหน้าที่ถูกต้องเสมอ ทุกการเปลี่ยนแปลงข้อมูลจะถูกบันทึกและแจ้งเตือนออกไปอัตโนมัติ',
    notes: [
      'เส้นทึบ = ลำดับขั้นตอนหลักที่ข้อมูลไหลจริง, เส้นประ = การแจ้งเตือน/บันทึกประวัติที่เกิดขนานไปโดยไม่กันขั้นตอนหลัก',
      'ทุกการสร้าง/แก้ไข/อนุมัติในทุกระบบ ถูกบันทึกลงประวัติการใช้งานระบบ (Audit Log) เสมอ ตรวจสอบย้อนหลังได้ที่เมนู "ประวัติการใช้งานระบบ"',
    ],
    definition: OVERVIEW_DIAGRAM,
  };

  readonly sections: IWorkflowSection[] = [
    {
      key: 'ticket',
      title: 'งานแจ้งซ่อม',
      icon: 'wrench-screwdriver',
      iconColor: 'text-amber-500',
      description:
        'ตั้งแต่ผู้ใช้แจ้งซ่อมจนถึงปิดงาน ระบบตรวจสอบการแจ้งซ้ำซ้อนก่อนสร้างใบใหม่เสมอ และเสนอเฉพาะสถานะถัดไปที่เป็นไปได้จริงในแต่ละขั้น (ห้ามข้ามขั้นตอนที่ไม่ได้กำหนดไว้)',
      notes: [
        'ยกเลิกงานได้เฉพาะช่วง "แจ้งซ่อมแล้ว / รับเรื่องแล้ว / ตรวจสอบเบื้องต้น / ส่งซ่อมภายนอก" เท่านั้น — หลังจากนั้นต้องดำเนินการต่อจนจบงาน',
        'ทุกการเปลี่ยนสถานะบันทึกลง Timeline แบบถาวร แก้ไขหรือลบย้อนหลังไม่ได้ เพื่อความโปร่งใส',
        'ช่างเทคนิค/เจ้าหน้าที่ไอที แก้ไขสถานะ/ผลตรวจสอบ/สรุปผลได้เฉพาะใบที่ตนแจ้งเองหรือได้รับมอบหมายเท่านั้น ส่วนแอดมิน/ผู้ดูแลระบบสูงสุดทำได้ทุกใบ',
      ],
      definition: TICKET_DIAGRAM,
    },
    {
      key: 'loan',
      title: 'ยืม-คืนครุภัณฑ์',
      icon: 'arrow-path',
      iconColor: 'text-teal-500',
      description:
        'ครุภัณฑ์ 1 ชิ้น ยืมได้ครั้งละ 1 รายการเท่านั้น ระบบจะบล็อกทันทีถ้ามีคนยืมอยู่ก่อนแล้ว แม้จะสแกนจากบัญชีคนละคนก็ตาม',
      notes: [
        'สิทธิ์แบบ "ยืม-คืนด้วยตนเอง" (self-service ผ่านสแกน QR) บันทึกได้เฉพาะรายการของตัวเองเท่านั้น ส่วนเจ้าหน้าที่ที่มีสิทธิ์เต็มบันทึกแทนผู้อื่นได้',
        '"เกินกำหนดคืน" เป็นป้ายที่คำนวณสดจากวันที่ ไม่ใช่สถานะที่ถูกบันทึกลงฐานข้อมูลจริง',
      ],
      definition: LOAN_DIAGRAM,
    },
    {
      key: 'vendor',
      title: 'ส่งซ่อมภายนอก',
      icon: 'building-office-2',
      iconColor: 'text-orange-500',
      description:
        'เกิดขึ้นเมื่อผลตรวจสอบเบื้องต้นของใบแจ้งซ่อมระบุว่าเกินขีดความสามารถซ่อมเอง — เป็นงานย่อยที่แยกติดตามจากใบแจ้งซ่อมหลัก แต่เชื่อมกลับเข้า flow เดิมโดยอัตโนมัติเมื่อรับเครื่องคืน',
      notes: [
        'ยกเลิก (CANCELLED) ได้จากทุกสถานะก่อนเสร็จสิ้น โดยเจ้าหน้าที่ผู้ดูแล',
        'แนบไฟล์ใบเสนอราคา/ใบแจ้งหนี้-ใบเสร็จได้ทุกขั้นตอนของกระบวนการ',
        'เลขที่ใบสั่งซ่อม (PO) ออกให้อัตโนมัติจากเลขรันกลางของระบบ ไม่ต้องกรอกเอง',
      ],
      definition: VENDOR_DIAGRAM,
    },
    {
      key: 'parts',
      title: 'คลังอะไหล่',
      icon: 'archive-box',
      iconColor: 'text-cyan-500',
      description:
        'ทุกการเคลื่อนไหวของอะไหล่บันทึกเป็นธุรกรรมพร้อมยอดคงเหลือหลังทำรายการเสมอ ระบบปฏิเสธการเบิก/จองที่เกินสต็อกจริงโดยอัตโนมัติ',
      notes: [
        'การเบิก/จองสามารถผูกกับใบแจ้งซ่อมที่เกี่ยวข้องได้ เพื่อดูย้อนหลังว่าใบไหนใช้อะไหล่อะไรไปบ้าง',
        '"ปรับยอด (ADJUST)" ใช้เฉพาะกรณีตรวจนับสต็อกจริงแล้วไม่ตรงกับระบบเท่านั้น',
      ],
      definition: PARTS_DIAGRAM,
    },
    {
      key: 'notification',
      title: 'การแจ้งเตือนหลายช่องทาง',
      icon: 'bell',
      iconColor: 'text-rose-500',
      description:
        'เหตุการณ์สำคัญของทุกระบบ (แจ้งซ่อมใหม่ เปลี่ยนสถานะ มอบหมายช่าง ยืม-คืน ฯลฯ) จะถูกส่งต่อไปยังช่องทางที่เกี่ยวข้องทั้งหมดพร้อมกันโดยอัตโนมัติ',
      notes: [
        'ช่องทางใดช่องทางหนึ่งล้มเหลว (เช่น อีเมลส่งไม่ออก) จะไม่กระทบขั้นตอนหลักของงานที่กำลังทำอยู่ — ระบบแยกความผิดพลาดของการแจ้งเตือนออกจาก flow หลักเสมอ',
        'ผู้ใช้แต่ละคนเปิด/ปิดช่องทางที่ต้องการรับเองได้ที่เมนู "ช่องทางการแจ้งเตือนส่วนตัว"',
      ],
      definition: NOTIFICATION_DIAGRAM,
    },
    {
      key: 'asset',
      title: 'ครุภัณฑ์ & QR Code',
      icon: 'qr-code',
      iconColor: 'text-indigo-500',
      description:
        'ครุภัณฑ์เข้าระบบได้ 2 ทาง (กรอกเอง หรือซิงค์จาก MOPH AssetTracker) แล้วออก QR Code ให้ทุกชิ้น — QR ที่พิมพ์ติดเครื่องคือจุดเริ่มต้นของทั้งงานแจ้งซ่อมและงานยืม-คืน',
      notes: [
        'การซิงค์จาก MOPH จะไม่ทับหมวดหมู่/หน่วยงานที่เจ้าหน้าที่แก้ไขไว้ภายหลัง เพื่อไม่ให้ข้อมูลที่แก้ไขแล้วหายไปตอนซิงค์รอบถัดไป',
        'QR ที่ฝังในป้ายเป็นลิงก์แบบสั้น ตรวจสอบสิทธิ์และความถูกต้องทุกครั้งที่สแกนจริง ไม่ใช่ลิงก์ตายตัวที่เดาได้',
      ],
      definition: ASSET_DIAGRAM,
    },
    {
      key: 'document',
      title: 'ออกเอกสารราชการ',
      icon: 'document-text',
      iconColor: 'text-blue-500',
      description: 'พิมพ์เอกสารทางการ (เช่น ใบแจ้งซ่อม/ใบส่งซ่อม) จากข้อมูลใบแจ้งซ่อมโดยตรง พร้อมออกเลขที่เอกสารอัตโนมัติทุกครั้ง',
      notes: [
        'ไฟล์ PDF สร้างขึ้นที่เบราว์เซอร์ของผู้ใช้งานเอง ก่อนอัปโหลดขึ้นเก็บที่เซิร์ฟเวอร์เป็นหลักฐาน',
        'เลขที่เอกสารเรียงลำดับอัตโนมัติแยกตามชนิดแบบฟอร์ม ตรวจสอบประวัติย้อนหลังได้ที่เมนู "ประวัติเอกสารราชการ"',
      ],
      definition: DOCUMENT_DIAGRAM,
    },
    {
      key: 'roles',
      title: 'บทบาทและสิทธิ์การใช้งาน',
      icon: 'shield-check',
      iconColor: 'text-emerald-600',
      description:
        'สิทธิ์แบ่งเป็น 2 มิติ: "เห็นงานของใครได้บ้าง" และ "แก้ไขงานของใครได้บ้าง" — ผู้ใช้งานทั่วไปเห็นเฉพาะงานตัวเอง ส่วนเจ้าหน้าที่เห็นทุกงานแต่แก้ไขได้ตามขอบเขตที่กำหนด',
      notes: [],
    },
  ];

  readonly roleMatrix: IRoleMatrixRow[] = [
    { role: 'ผู้ดูแลระบบสูงสุด (SUPER_ADMIN)', viewTickets: 'ทุกใบ', editTickets: 'ทุกใบ ไม่จำกัด', adminAccess: 'จัดการผู้ใช้/สิทธิ์/ตั้งค่าระบบได้ทั้งหมด' },
    { role: 'ผู้ดูแลระบบ (ADMIN)', viewTickets: 'ทุกใบ', editTickets: 'ทุกใบ ไม่จำกัด', adminAccess: 'จัดการผู้ใช้/สิทธิ์/ตั้งค่าระบบได้ตามที่กำหนด' },
    { role: 'เจ้าหน้าที่ไอที (IT_OFFICER)', viewTickets: 'ทุกใบ', editTickets: 'เฉพาะที่แจ้งเองหรือได้รับมอบหมาย', adminAccess: 'ไม่มี' },
    { role: 'ช่างเทคนิค (TECHNICIAN)', viewTickets: 'ทุกใบ', editTickets: 'เฉพาะที่แจ้งเองหรือได้รับมอบหมาย', adminAccess: 'ไม่มี' },
    { role: 'ผู้ใช้งานทั่วไป (USER)', viewTickets: 'เฉพาะที่ตัวเองแจ้ง', editTickets: 'เฉพาะที่ตัวเองแจ้ง (แจ้งซ่อม/ติดตาม/ปิดงานของตน)', adminAccess: 'ไม่มี' },
  ];

  constructor() {
    effect(() => {
      const mode = this.themeService.mode();
      void this.renderAll(mode);
    });
  }

  svgFor(key: string): SafeHtml | null {
    return this.svgByKey()[key] ?? null;
  }

  private async renderAll(mode: ThemeMode): Promise<void> {
    this.loading.set(true);
    this.renderError.set(null);

    try {
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        themeVariables: this.buildThemeVariables(mode),
        flowchart: { htmlLabels: true, curve: 'basis', padding: 12 },
        securityLevel: 'strict',
        fontFamily: 'inherit',
      });

      const all = [this.overview, ...this.sections].filter((s) => s.definition);
      const svgs: Record<string, SafeHtml> = {};
      for (const section of all) {
        const { svg } = await mermaid.render(`khd-mermaid-${section.key}-${mode}`, section.definition!);
        svgs[section.key] = this.sanitizer.bypassSecurityTrustHtml(this.staggerEntranceAnimation(svg));
      }
      this.svgByKey.set(svgs);
    } catch (err) {
      this.renderError.set('ไม่สามารถแสดงผังการทำงานได้ กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง');
      console.error('[workflow-diagrams] mermaid render failed', err);
    } finally {
      this.loading.set(false);
    }
  }

  /** ไล่เวลาหน่วง (animation-delay) ให้แต่ละโหนดค่อยๆ ปรากฏทีละตัวตามลำดับที่ mermaid วาดจริง แทนที่จะกระพริบพร้อมกันทั้งภาพ
   * — ทำที่นี่แทนใน CSS เพราะจำนวนโหนดแต่ละผังไม่เท่ากัน กำหนดล่วงหน้าด้วย nth-child ไม่ครอบคลุม
   * ใช้ div.innerHTML (parser แบบ HTML ที่ผ่อนปรน) แทน DOMParser('image/svg+xml') เพราะ SVG ที่ mermaid สร้างตอนเปิด
   * htmlLabels ไม่ใช่ XML ที่ well-formed จริง (มี foreignObject/div ปนอยู่) ทำให้ parse แบบ XML strict ล้มเหลวเงียบๆ
   * ล้มเหลวได้อย่างปลอดภัย: คืนค่า SVG เดิมถ้ามีปัญหา (แอนิเมชันเป็นแค่ของตกแต่ง ไม่ควรทำให้ผังทั้งหมดหายไป) */
  private staggerEntranceAnimation(svg: string): string {
    try {
      const container = document.createElement('div');
      container.innerHTML = svg;

      const STEP_MS = 35;
      const MAX_DELAY_MS = 500;
      container.querySelectorAll('.node').forEach((node, i) => {
        (node as SVGElement).style.animationDelay = `${Math.min(i * STEP_MS, MAX_DELAY_MS)}ms`;
      });

      return container.innerHTML;
    } catch {
      return svg;
    }
  }

  /** สีธีมของผัง mermaid — ยึดโทนเขียวของแบรนด์ (brand-primary #006C45) ให้เข้ากับสีระบบทั้งโหมดสว่าง/มืด */
  private buildThemeVariables(mode: ThemeMode): Record<string, string> {
    if (mode === 'dark') {
      return {
        background: '#171717',
        primaryColor: '#0f3d2c',
        primaryTextColor: '#e5f7ee',
        primaryBorderColor: '#00A86B',
        lineColor: '#34d399',
        secondaryColor: '#262626',
        secondaryTextColor: '#e5e7eb',
        secondaryBorderColor: '#525252',
        tertiaryColor: '#1f2937',
        tertiaryTextColor: '#e5e7eb',
        tertiaryBorderColor: '#525252',
        textColor: '#e5e7eb',
        edgeLabelBackground: '#171717',
        clusterBkg: '#1f2937',
        fontSize: '14px',
      };
    }
    return {
      background: '#ffffff',
      primaryColor: '#E3F2E9',
      primaryTextColor: '#0f2e22',
      primaryBorderColor: '#006C45',
      lineColor: '#006C45',
      secondaryColor: '#F7FAF8',
      secondaryTextColor: '#1f2937',
      secondaryBorderColor: '#d1d5db',
      tertiaryColor: '#ffffff',
      tertiaryTextColor: '#1f2937',
      tertiaryBorderColor: '#d1d5db',
      textColor: '#1f2937',
      edgeLabelBackground: '#ffffff',
      clusterBkg: '#F7FAF8',
      fontSize: '14px',
    };
  }
}
