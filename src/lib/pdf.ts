/**
 * Minimal, dependency-free PDF 1.4 writer.
 * Produces a genuine multi-page PDF (Helvetica, A4 landscape) with a title
 * block and a paginated text table — used for ERP report exports and payslips.
 * This is deliberately simple: no images, no vector charts. Text is escaped for
 * the PDF literal string syntax.
 */

export interface PdfTable {
  columns: string[];
  rows: string[][];
}

interface PdfOptions {
  title: string;
  subtitle?: string;
  table?: PdfTable;
  footerNote?: string;
  /** Lines of free text (used for payslip style documents). */
  sections?: Array<{ heading: string; lines: string[] }>;
}

const PAGE_WIDTH = 842; // A4 landscape
const PAGE_HEIGHT = 595;
const MARGIN = 36;
const FONT_SIZE = 8;
const LINE_HEIGHT = 12;

function esc(text: string): string {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[\r\n\t]/g, ' ');
}

/** Approximate Helvetica string width in points (avg char width ≈ 0.5 × size). */
function textWidth(text: string, size = FONT_SIZE): number {
  return text.length * size * 0.5;
}

function truncate(text: string, maxWidth: number, size = FONT_SIZE): string {
  if (textWidth(text, size) <= maxWidth) return text;
  const maxChars = Math.max(1, Math.floor(maxWidth / (size * 0.5)) - 1);
  return text.slice(0, maxChars) + '…';
}

interface StreamPage {
  ops: string[];
}

export function buildPdf(opts: PdfOptions): Uint8Array {
  const pages: StreamPage[] = [];
  let current: StreamPage = { ops: [] };
  let y = PAGE_HEIGHT - MARGIN;

  const newPage = () => {
    pages.push(current);
    current = { ops: [] };
    y = PAGE_HEIGHT - MARGIN;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) newPage();
  };

  const text = (
    str: string,
    x: number,
    atY: number,
    size = FONT_SIZE,
    bold = false,
    grey = 0
  ) => {
    const font = bold ? '/F2' : '/F1';
    const colour = grey > 0 ? `${grey} ${grey} ${grey} rg` : '0 0 0 rg';
    current.ops.push(
      `BT ${colour} ${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${atY.toFixed(2)} Tm (${esc(str)}) Tj ET`
    );
  };

  const line = (x1: number, y1: number, x2: number, y2: number, grey = 0.75) => {
    current.ops.push(
      `${grey} ${grey} ${grey} RG 0.5 w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} S`
    );
  };

  const fillRect = (x: number, yPos: number, w: number, h: number, grey = 0.93) => {
    current.ops.push(
      `${grey} ${grey} ${grey} rg ${x.toFixed(2)} ${yPos.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`
    );
  };

  // ---------- Title block (repeated on every page) ----------
  const drawHeader = () => {
    text('CHALAR FARMS LIMITED', MARGIN, y, 13, true);
    y -= 16;
    text(opts.title, MARGIN, y, 10, true);
    y -= 13;
    if (opts.subtitle) {
      text(opts.subtitle, MARGIN, y, 7.5, false, 0.35);
      y -= 12;
    }
    line(MARGIN, y, PAGE_WIDTH - MARGIN, y, 0.6);
    y -= 14;
  };

  drawHeader();

  // ---------- Optional free-text sections ----------
  if (opts.sections) {
    for (const section of opts.sections) {
      ensureSpace(LINE_HEIGHT * 2);
      text(section.heading.toUpperCase(), MARGIN, y, 8.5, true);
      y -= LINE_HEIGHT;
      for (const l of section.lines) {
        ensureSpace(LINE_HEIGHT);
        const [label, ...rest] = l.split(':');
        const value = rest.join(':').trim();
        text(label + ':', MARGIN + 4, y, 8, false, 0.25);
        text(value, MARGIN + 190, y, 8, true);
        y -= LINE_HEIGHT;
      }
      y -= 4;
    }
  }

  // ---------- Table ----------
  if (opts.table && opts.table.columns.length > 0) {
    const usableWidth = PAGE_WIDTH - MARGIN * 2;
    const colCount = opts.table.columns.length;

    // Column widths: proportional to the longest cell, clamped
    const rawWidths = opts.table.columns.map((c, i) => {
      const longest = Math.max(
        textWidth(c, 7.5),
        ...opts.table!.rows.slice(0, 200).map((r) => textWidth(String(r[i] ?? ''), FONT_SIZE))
      );
      return Math.max(38, Math.min(longest + 8, 230));
    });
    const scale = usableWidth / rawWidths.reduce((a, b) => a + b, 0);
    const widths = rawWidths.map((w) => w * scale);

    const drawTableHeader = () => {
      fillRect(MARGIN, y - 3, usableWidth, 12);
      let x = MARGIN + 3;
      opts.table!.columns.forEach((c, i) => {
        text(truncate(c, widths[i] - 6, 7.5), x, y, 7.5, true);
        x += widths[i];
      });
      y -= LINE_HEIGHT + 2;
      line(MARGIN, y + 3, PAGE_WIDTH - MARGIN, y + 3, 0.55);
    };

    drawTableHeader();

    opts.table.rows.forEach((row, rowIdx) => {
      ensureSpace(LINE_HEIGHT + 16);
      if (y > PAGE_HEIGHT - MARGIN - 20) {
        // fresh page: redraw the banner + header row
        drawHeader();
        drawTableHeader();
      }
      if (rowIdx % 2 === 1) {
        fillRect(MARGIN, y - 3, usableWidth, LINE_HEIGHT, 0.97);
      }
      let x = MARGIN + 3;
      row.forEach((cell, i) => {
        text(truncate(String(cell ?? ''), widths[i] - 6), x, y, FONT_SIZE);
        x += widths[i];
      });
      y -= LINE_HEIGHT;
    });

    ensureSpace(LINE_HEIGHT);
    line(MARGIN, y + 4, PAGE_WIDTH - MARGIN, y + 4, 0.55);
    y -= LINE_HEIGHT;
    text(
      `${opts.table.rows.length} record(s) · generated by the Chalar Farms ERP from live database records`,
      MARGIN,
      y,
      7,
      false,
      0.4
    );
  }

  if (opts.footerNote) {
    y -= LINE_HEIGHT;
    ensureSpace(LINE_HEIGHT);
    text(opts.footerNote, MARGIN, y, 7, false, 0.4);
  }

  pages.push(current);

  // ---------- Assemble the PDF file ----------
  const objects: string[] = [];
  const addObj = (body: string) => {
    objects.push(body);
    return objects.length; // 1-based object number
  };

  const catalogId = objects.length + 1; // placeholder positions computed below
  // 1: Catalog, 2: Pages, 3: Helvetica, 4: Helvetica-Bold, then page/content pairs
  const pageIds: number[] = [];
  const contentIds: number[] = [];

  const pagesObjId = 2;
  const fontRegularId = 3;
  const fontBoldId = 4;
  let nextId = 5;
  for (let i = 0; i < pages.length; i++) {
    pageIds.push(nextId++);
    contentIds.push(nextId++);
  }

  const kids = pageIds.map((id) => `${id} 0 R`).join(' ');
  const objs: string[] = [];
  objs[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesObjId} 0 R >>`;
  objs[pagesObjId - 1] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`;
  objs[fontRegularId - 1] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
  objs[fontBoldId - 1] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`;

  pages.forEach((page, i) => {
    const content = page.ops.join('\n');
    objs[pageIds[i] - 1] =
      `<< /Type /Page /Parent ${pagesObjId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> ` +
      `/Contents ${contentIds[i]} 0 R >>`;
    objs[contentIds[i] - 1] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });
  void addObj;

  // ---------- Serialize ----------
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let offset = 0;
  const offsets: number[] = [];

  const push = (s: string | Uint8Array) => {
    const bytes = typeof s === 'string' ? encoder.encode(s) : s;
    chunks.push(bytes);
    offset += bytes.length;
  };

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  objs.forEach((body, idx) => {
    offsets[idx] = offset;
    push(`${idx + 1} 0 obj\n${body}\nendobj\n`);
  });

  const xrefStart = offset;
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  push(xref);
  push(
    `trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  );

  const total = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}
