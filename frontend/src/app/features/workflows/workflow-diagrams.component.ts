import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { NgTemplateOutlet } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { ThemeService, type ThemeMode } from '../../core/services/theme.service';
import { downloadBlob } from '../../core/utils/download.util';
import { DATA_EXCHANGE, OVERVIEW, ROLE_MATRIX, SECTIONS, type SopActor } from './workflow-diagrams.data';

interface IActorColor {
  fill: string;
  stroke: string;
  text: string;
}

/** สีตามผู้รับผิดชอบ/ชนิดโหนด — ใช้ทั้งใน classDef ของ mermaid และป้ายในคำอธิบายสัญลักษณ์/ตาราง SOP ให้ตรงกันเสมอ */
const ACTOR_PALETTE: Record<ThemeMode, Record<SopActor, IActorColor>> = {
  light: {
    user: { fill: '#E9F7EE', stroke: '#2F853D', text: '#14532D' },
    staff: { fill: '#EAF1FF', stroke: '#1F6FD1', text: '#0B2545' },
    tech: { fill: '#E3F6F4', stroke: '#0F8F86', text: '#134E4A' },
    sys: { fill: '#F4F6FA', stroke: '#64728A', text: '#111B2D' },
    ext: { fill: '#FCEEF6', stroke: '#C0267A', text: '#701A45' },
    store: { fill: '#F1ECFF', stroke: '#7C3AED', text: '#3B1A7A' },
    decide: { fill: '#FFF4E0', stroke: '#D97706', text: '#78350F' },
    start: { fill: '#0B2545', stroke: '#0B2545', text: '#FFFFFF' },
    blocked: { fill: '#FEE2E2', stroke: '#DC2626', text: '#7F1D1D' },
  },
  dark: {
    user: { fill: '#14301F', stroke: '#5FBF73', text: '#DCFCE7' },
    staff: { fill: '#1A2C4D', stroke: '#7AACFF', text: '#E6EBF2' },
    tech: { fill: '#10322F', stroke: '#4CBCB1', text: '#CCFBF1' },
    sys: { fill: '#172235', stroke: '#8E9BB0', text: '#E6EBF2' },
    ext: { fill: '#3A1630', stroke: '#F075B5', text: '#FCE7F3' },
    store: { fill: '#2A1F4A', stroke: '#A78BFA', text: '#EDE9FE' },
    decide: { fill: '#3A2A10', stroke: '#F5B544', text: '#FEF3C7' },
    start: { fill: '#7AACFF', stroke: '#7AACFF', text: '#0A111E' },
    blocked: { fill: '#4C1D1D', stroke: '#F87171', text: '#FECACA' },
  },
};

const ACTOR_LEGEND: { actor: SopActor; label: string }[] = [
  { actor: 'user', label: 'ผู้ใช้/ผู้แจ้ง/ผู้ยืม' },
  { actor: 'staff', label: 'เจ้าหน้าที่ไอที/ผู้ดูแลระบบ' },
  { actor: 'tech', label: 'ช่างเทคนิค' },
  { actor: 'sys', label: 'ระบบทำงานอัตโนมัติ' },
  { actor: 'ext', label: 'ระบบภายนอก/ช่องทางส่ง' },
  { actor: 'store', label: 'ฐานข้อมูล/ที่เก็บข้อมูล' },
  { actor: 'decide', label: 'จุดตัดสินใจ' },
  { actor: 'blocked', label: 'ไม่ผ่าน/ถูกบล็อก/ยกเลิก' },
];

const EDGE_LINE = /^(\s*)(\w+)\s+(-->|-\.->|<-->)(\|"[^"]*"\|)?\s*(\w+)\s*$/;
const BLOCKED_NODE = /^\s*(\w+)[[({][^\n]*:::blocked\s*$/;

@Component({
  selector: 'khd-workflow-diagrams',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, MatTabsModule, MatButtonModule, MatTooltipModule, IconComponent, PageHeaderComponent, LoadingStateComponent],
  templateUrl: './workflow-diagrams.component.html',
  styleUrl: './workflow-diagrams.component.scss',
})
export class WorkflowDiagramsComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly themeService = inject(ThemeService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  readonly overview = OVERVIEW;
  readonly sections = SECTIONS;
  readonly dataExchange = DATA_EXCHANGE;
  readonly roleMatrix = ROLE_MATRIX;
  readonly actorLegend = ACTOR_LEGEND;

  readonly loading = signal(true);
  readonly renderError = signal<string | null>(null);
  readonly selectedIndex = signal(0);
  private readonly tabsAnchor = viewChild<ElementRef<HTMLElement>>('tabsAnchor');
  private readonly svgByKey = signal<Record<string, SafeHtml>>({});
  private rawSvgByKey: Record<string, string> = {};

  /** ความเร็วเส้นไหล (วินาทีต่อรอบ) — วาดใหม่เฉพาะตอนปล่อยสไลเดอร์ (mermaid.render ใหม่ทุกผังมีต้นทุนสูง) */
  readonly flowSpeedDisplay = signal(8);
  readonly flowSpeedSec = signal(8);

  readonly palette = computed(() => ACTOR_PALETTE[this.themeService.mode()]);

  constructor() {
    effect(() => {
      void this.renderAll(this.themeService.mode(), this.flowSpeedSec());
    });

    // mat-tab-group สร้างเนื้อหาแท็บตอนเปิดครั้งแรก — เฝ้า DOM เพื่อเติมคลาส .khd-in ให้โหนดที่เพิ่งแทรก (ค่อยๆ ปรากฏครั้งเดียว)
    const observer = new MutationObserver((mutations) => {
      const nodes: Element[] = [];
      for (const m of mutations) {
        m.addedNodes.forEach((n) => {
          if (!(n instanceof Element)) return;
          if (n.matches('.node')) nodes.push(n);
          nodes.push(...Array.from(n.querySelectorAll('.node')));
        });
      }
      if (nodes.length === 0) return;
      requestAnimationFrame(() => requestAnimationFrame(() => nodes.forEach((el) => el.classList.add('khd-in'))));
    });
    observer.observe(this.elementRef.nativeElement, { childList: true, subtree: true });
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  onSpeedInput(value: number): void {
    this.flowSpeedDisplay.set(value);
  }

  onSpeedChange(value: number): void {
    this.flowSpeedDisplay.set(value);
    this.flowSpeedSec.set(value);
  }

  openSection(index: number): void {
    this.selectedIndex.set(index);
    this.tabsAnchor()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  svgFor(key: string): SafeHtml | null {
    return this.svgByKey()[key] ?? null;
  }

  colorOf(actor: SopActor): IActorColor {
    return this.palette()[actor];
  }

  downloadSvg(key: string, title: string): void {
    const svg = this.rawSvgByKey[key];
    if (!svg) return;
    downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `SOP-${title}.svg`);
  }

  private async renderAll(mode: ThemeMode, mainDurationSec: number): Promise<void> {
    this.loading.set(true);
    this.renderError.set(null);
    try {
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        themeVariables: this.buildThemeVariables(mode),
        flowchart: { htmlLabels: true, curve: 'basis', padding: 14, nodeSpacing: 36, rankSpacing: 44 },
        securityLevel: 'strict',
        fontFamily: 'inherit',
      });

      const all = [this.overview.architecture, this.overview.modules, ...this.sections].filter((s) => s.definition);
      const svgs: Record<string, SafeHtml> = {};
      const raw: Record<string, string> = {};
      for (const section of all) {
        const { svg } = await mermaid.render(`khd-mermaid-${section.key}-${mode}`, this.prepareDefinition(section.definition!, mode));
        raw[section.key] = svg;
        svgs[section.key] = this.sanitizer.bypassSecurityTrustHtml(this.enhanceSvg(svg, section.key, mainDurationSec));
      }
      this.rawSvgByKey = raw;
      this.svgByKey.set(svgs);
    } catch (err) {
      this.renderError.set('ไม่สามารถแสดงผังการทำงานได้ กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง');
      console.error('[workflow-diagrams] mermaid render failed', err);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * เติมส่วนที่นิยามผังไม่ต้องเขียนเอง: id + แอนิเมชันของเส้น (ทึบ = ไหลเร็ว, ประ = ไหลช้า, สองทาง = ไม่ไหล),
   * สีเส้นที่ชี้เข้าโหนด "ไม่ผ่าน" (linkStyle ตามลำดับเส้น 0-based) และ classDef สีตามผู้รับผิดชอบของธีมปัจจุบัน
   */
  private prepareDefinition(definition: string, mode: ThemeMode): string {
    const blockedNodes = new Set<string>();
    const subgraphs = new Set<string>();
    for (const line of definition.split('\n')) {
      const m = BLOCKED_NODE.exec(line);
      if (m) blockedNodes.add(m[1]);
      const sg = /^\s*subgraph\s+(\w+)/.exec(line);
      if (sg) subgraphs.add(sg[1]);
    }

    let edgeIndex = 0;
    const animations: string[] = [];
    const blockedEdges: number[] = [];
    const lines = definition.split('\n').map((line) => {
      const m = EDGE_LINE.exec(line);
      if (!m) return line;
      const [, indent, from, arrow, label = '', to] = m;
      const index = edgeIndex++;
      if (blockedNodes.has(to)) blockedEdges.push(index);
      // เส้นสองทาง และเส้นที่ชี้เข้า/ออกจากกลุ่มทั้งกลุ่ม (subgraph) ไม่ใส่แอนิเมชัน — จุดเคลื่อนที่หาเส้นทางจริงไม่เจอ
      if (arrow === '<-->' || subgraphs.has(from) || subgraphs.has(to)) return line;
      const id = `e${index}`;
      animations.push(`  ${id}@{ animate: true${arrow === '-.->' ? ', animation: slow' : ''} }`);
      return `${indent}${from} ${id}@${arrow}${label} ${to}`;
    });

    const p = ACTOR_PALETTE[mode];
    const classDefs = (Object.keys(p) as SopActor[]).map((k) => {
      const c = p[k];
      const dash = k === 'ext' ? ',stroke-dasharray:5 3' : '';
      return `  classDef ${k} fill:${c.fill},stroke:${c.stroke},color:${c.text},stroke-width:1.5px${dash};`;
    });
    const blockedStyle = blockedEdges.length
      ? [`  linkStyle ${blockedEdges.join(',')} stroke:${p.blocked.stroke} !important,stroke-width:2.5px;`]
      : [];
    return [...lines, ...animations, ...classDefs, ...blockedStyle].join('\n');
  }

  /** หลัง render: ไล่จังหวะให้โหนดค่อยๆ ปรากฏ และเติมจุดเคลื่อนที่ตามเส้น (SMIL animateMotion) ให้เห็นทิศทางข้อมูล
   * — ใช้ div.innerHTML แทน DOMParser XML เพราะ SVG ที่มี htmlLabels ไม่ใช่ XML ที่ well-formed; ล้มเหลวก็คืน SVG เดิม */
  private enhanceSvg(svg: string, diagramKey: string, mainDurationSec: number): string {
    try {
      const container = document.createElement('div');
      container.innerHTML = svg;

      container.querySelectorAll<HTMLElement>('.node').forEach((node, i) => {
        node.style.transitionDelay = `${Math.min(i * 35, 500)}ms`;
      });

      const secondaryDurationSec = mainDurationSec * 1.8;
      const svgEl = container.querySelector('svg');
      const svgNs = 'http://www.w3.org/2000/svg';
      container
        .querySelectorAll<SVGPathElement>('.edgePaths path.edge-animation-fast, .edgePaths path.edge-animation-slow')
        .forEach((path, i) => {
          const pathId = `khd-edge-${diagramKey}-${i}`;
          path.setAttribute('id', pathId);
          const isSecondary = path.classList.contains('edge-animation-slow');
          path.style.animationDuration = `${isSecondary ? secondaryDurationSec : mainDurationSec}s`;

          const dot = document.createElementNS(svgNs, 'circle');
          dot.setAttribute('r', isSecondary ? '3.5' : '5');
          dot.setAttribute('class', isSecondary ? 'khd-flow-dot khd-flow-dot-secondary' : 'khd-flow-dot');
          const motion = document.createElementNS(svgNs, 'animateMotion');
          motion.setAttribute('dur', `${isSecondary ? secondaryDurationSec * 1.1 : mainDurationSec * 1.2}s`);
          motion.setAttribute('repeatCount', 'indefinite');
          const mpath = document.createElementNS(svgNs, 'mpath');
          mpath.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#${pathId}`);
          mpath.setAttribute('href', `#${pathId}`);
          motion.appendChild(mpath);
          const blink = document.createElementNS(svgNs, 'animate');
          blink.setAttribute('attributeName', 'opacity');
          blink.setAttribute('values', isSecondary ? '0.15;0.85;0.15' : '0.2;1;0.2');
          blink.setAttribute('dur', `${Math.max(isSecondary ? 1.2 : 0.9, (isSecondary ? secondaryDurationSec : mainDurationSec) * 0.3)}s`);
          blink.setAttribute('repeatCount', 'indefinite');
          dot.appendChild(motion);
          dot.appendChild(blink);
          svgEl?.appendChild(dot);
        });

      return container.innerHTML;
    } catch {
      return svg;
    }
  }

  private buildThemeVariables(mode: ThemeMode): Record<string, string> {
    const fontFamily = '"IBM Plex Sans Thai", "Noto Sans Thai", sans-serif';
    if (mode === 'dark') {
      return {
        background: '#121B2B',
        primaryColor: '#1A2C4D',
        primaryTextColor: '#E6EBF2',
        primaryBorderColor: '#7AACFF',
        lineColor: '#8E9BB0',
        textColor: '#E6EBF2',
        edgeLabelBackground: '#121B2B',
        clusterBkg: '#0F1828',
        clusterBorder: '#334766',
        titleColor: '#E6EBF2',
        fontFamily,
        fontSize: '14px',
      };
    }
    return {
      background: '#ffffff',
      primaryColor: '#EAF1FF',
      primaryTextColor: '#0B2545',
      primaryBorderColor: '#1F6FD1',
      lineColor: '#8E9BB0',
      textColor: '#111B2D',
      edgeLabelBackground: '#ffffff',
      clusterBkg: '#F8FAFC',
      clusterBorder: '#C3CCD9',
      titleColor: '#0B2545',
      fontFamily,
      fontSize: '14px',
    };
  }
}
