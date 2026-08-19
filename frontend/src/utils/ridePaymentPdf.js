const escapePdf = (s) =>
  String(s)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const GLYPH_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const BOLD_GLYPH_WIDTHS = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 611, 611, 556, 611, 611, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 556, 389, 389, 389, 584,
];

const textWidth = (str, size, bold = false) => {
  const table = bold ? BOLD_GLYPH_WIDTHS : GLYPH_WIDTHS;
  let units = 0;
  for (const ch of String(str)) {
    const code = ch.charCodeAt(0);
    units += code >= 32 && code < table.length ? table[code] : bold ? 556 : 500;
  }
  return (units * size) / 1000;
};

class PdfPage {
  constructor(width = 595, height = 842) {
    this.width = width;
    this.height = height;
    this.ops = [];
  }

  text(str, x, y, { size = 10, bold = false, color = null } = {}) {
    const key = bold ? "F2" : "F1";
    const colorOp = color ? `${color[0]} ${color[1]} ${color[2]} rg ` : "";
    this.ops.push(`${colorOp}BT /${key} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${escapePdf(str)}) Tj ET`);
  }

  wrappedText(str, x, y, { size = 10, bold = false, color = null, maxWidth = 400, lineHeight = null } = {}) {
    const lineH = lineHeight || size * 1.4;
    const words = String(str).split(/\s+/);
    let currentLine = "";
    const lines = [];
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (textWidth(testLine, size, bold) > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    let curY = y;
    for (const line of lines) {
      this.text(line, x, curY, { size, bold, color });
      curY -= lineH;
    }
    return { lines: lines.length, nextY: curY };
  }

  rightText(str, xRight, y, { size = 10, bold = false, color = null } = {}) {
    const width = textWidth(str, size, bold);
    this.text(str, xRight - width, y, { size, bold, color });
  }

  rule(x1, y1, x2, y2, color = [0.82, 0.87, 0.93]) {
    this.ops.push(`${color[0]} ${color[1]} ${color[2]} RG 0.75 w ${x1} ${y1} m ${x2} ${y2} l S`);
  }

  bar(x, y, w, h, color = [0.09, 0.47, 0.95]) {
    this.ops.push(`${color[0]} ${color[1]} ${color[2]} rg ${x} ${y} ${w} ${h} re f`);
  }

  content() {
    return this.ops.join("\n");
  }
}

const buildBlob = (pages) => {
  const objects = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const kids = pages.map((_, i) => `${i + 3} 0 R`).join(" ");
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  pages.forEach((page) => {
    const pageNumber = objects.length + 1;
    const contentNumber = objects.length + 2;
    const fontA = 3 + pages.length * 2;
    const fontB = 4 + pages.length * 2;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /Font << /F1 ${fontA} 0 R /F2 ${fontB} 0 R >> >> /Contents ${contentNumber} 0 R >>`
    );
    const contentStream = page.content();
    objects.push(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`);
  });
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((obj, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
};

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const formatMoney = (value) =>
  `BDT ${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

const methodLabel = (method) => (method === "BKASH" ? "bKash" : "Manual");

export function downloadTransactionHistoryPdf({ data = [], totals = {} }) {
  const PAGE_W = 595;
  const PAGE_H = 842;
  const MARGIN = 48;
  const BOTTOM_Y = 65;
  const USABLE = PAGE_W - MARGIN * 2;

  const COLS = [
    { key: "date", label: "DATE & TIME", w: Math.round(USABLE * 0.14) },
    { key: "txn", label: "TRANSACTION / ROUTE", w: Math.round(USABLE * 0.34) },
    { key: "party", label: "COUNTERPARTY", w: Math.round(USABLE * 0.18) },
    { key: "type", label: "TYPE", w: Math.round(USABLE * 0.10) },
    { key: "method", label: "METHOD", w: Math.round(USABLE * 0.08) },
  ];
  COLS.push({ key: "amount", label: "AMOUNT", w: USABLE - COLS.reduce((s, c) => s + c.w, 0) });

  const colLeft = {};
  let accum = MARGIN;
  COLS.forEach((c) => { colLeft[c.key] = accum; accum += c.w; });
  colLeft.date = MARGIN - 2;

  const ROW_PAD = 5;
  const TEXT_SIZE = 8;
  const SUB_SIZE = 7;
  const LINE_H = 10;
  const ROUTE_SIZE = 7.5;

  const pages = [new PdfPage(PAGE_W)];
  let pg = pages[0];
  let y = PAGE_H - 50;

  const foot = (p) => {
    p.text("Campus Ride Sharing", MARGIN, 38, { size: 7, color: [0.5, 0.55, 0.6] });
    p.rightText("Page " + (pages.indexOf(p) + 1), PAGE_W - MARGIN, 38, { size: 7, color: [0.5, 0.55, 0.6] });
  };

  const drawPageHeader = () => {
    pg.text("TRANSACTION HISTORY", MARGIN, y, { size: 18, bold: true });
    y -= 14;
    pg.text("Campus Ride Sharing - All payments you recorded", MARGIN, y, { size: 9, color: [0.45, 0.52, 0.6] });
    y -= 10;
    pg.text("Generated " + formatDate(Date.now()), MARGIN, y, { size: 8, color: [0.45, 0.52, 0.6] });
    y -= 14;
    pg.rule(MARGIN, y, PAGE_W - MARGIN, y);
    y -= 6;
    drawTableHeader();
  };

  const drawTableHeader = () => {
    pg.bar(MARGIN, y - 10, USABLE, 20, [0.09, 0.47, 0.95]);
    COLS.forEach((c) => {
      if (c.key === "amount") {
        pg.rightText(c.label, colLeft.amount + c.w - 4, y, { size: 7.5, bold: true, color: [1, 1, 1] });
      } else {
        pg.text(c.label, colLeft[c.key] + 4, y, { size: 7.5, bold: true, color: [1, 1, 1] });
      }
    });
    y -= 24;
    pg.ops.push("0 0 0 rg");
  };

  const startNewPage = () => {
    foot(pg);
    pages.push(new PdfPage(PAGE_W));
    pg = pages[pages.length - 1];
    y = PAGE_H - 50;
    drawPageHeader();
  };

  const need = (h) => { if (y - h < BOTTOM_Y) startNewPage(); };

  const countWrappedLines = (text, size, maxW) => {
    if (!text) return 0;
    const words = text.split(/\s+/);
    let lines = 1;
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (textWidth(test, size) > maxW && cur) { lines++; cur = w; }
      else { cur = test; }
    }
    return lines;
  };

  drawPageHeader();

  if (!data.length) {
    pg.text("No transactions found.", MARGIN, y, { size: 10, color: [0.55, 0.58, 0.62] });
    y -= 20;
  }

  data.forEach((t, idx) => {
    const routeText = t.ride ? t.ride.pickup + " to " + t.ride.dropoff : "";
    const routeMaxW = COLS.find((c) => c.key === "txn").w - 10;
    const routeLines = routeText ? countWrappedLines(routeText, ROUTE_SIZE, routeMaxW) : 0;
    const cellLines = Math.max(2, routeLines + 1);
    const rowH = cellLines * LINE_H + ROW_PAD * 2;

    need(rowH + 4);

    if (idx > 0) {
      pg.rule(MARGIN, y + 10, PAGE_W - MARGIN, y + 10, [0.88, 0.9, 0.93]);
    }

    const dateStr = formatDate(t.createdAt);
    pg.text(dateStr, colLeft.date + 4, y + 1, { size: TEXT_SIZE });

    const idStr = t.isMerged ? (t.transactionId || "-") + " + fine" : (t.transactionId || "-");
    pg.text(idStr, colLeft.txn + 4, y + 1, { size: SUB_SIZE, bold: true, color: [0.3, 0.35, 0.42] });
    if (routeText) {
      pg.wrappedText(routeText, colLeft.txn + 4, y + 1 - LINE_H, {
        size: ROUTE_SIZE,
        color: [0.5, 0.55, 0.6],
        maxWidth: routeMaxW,
        lineHeight: LINE_H,
      });
    }

    const partyName = t.counterparty?.name || "-";
    pg.text(partyName, colLeft.party + 4, y + 1, { size: TEXT_SIZE });
    const partyDept = t.counterparty ? [t.counterparty.department, t.counterparty.year].filter(Boolean).join(" ") : "";
    if (partyDept) {
      pg.text(partyDept, colLeft.party + 4, y + 1 - LINE_H, { size: SUB_SIZE, color: [0.5, 0.55, 0.6] });
    }

    const typeLabel = t.isMerged ? "Refund+Fine" : t.kind === "FINE" ? "Fine" : t.direction === "received" ? "Received" : "Paid";
    pg.text(typeLabel, colLeft.type + 4, y + 1, { size: TEXT_SIZE });

    pg.text(methodLabel(t.method), colLeft.method + 4, y + 1, { size: TEXT_SIZE });

    const amtColor = t.direction === "received" ? [0.06, 0.55, 0.3] : [0.85, 0.15, 0.22];
    pg.rightText(formatMoney(t.amount), colLeft.amount + COLS.find((c) => c.key === "amount").w - 4, y + 1, { size: TEXT_SIZE, bold: true, color: amtColor });

    y -= rowH;
  });

  y -= 16;
  need(100);

  pg.rule(MARGIN, y, PAGE_W - MARGIN, y, [0.82, 0.87, 0.93]);
  y -= 30;
  pg.text("SUMMARY", MARGIN, y, { size: 11, bold: true });
  y -= 24;
  pg.text("Total received", MARGIN + 4, y, { size: 9, color: [0.06, 0.55, 0.3] });
  pg.rightText(formatMoney(totals.received), PAGE_W - MARGIN - 4, y, { size: 9, bold: true, color: [0.06, 0.55, 0.3] });
  y -= 20;
  pg.text("Total paid", MARGIN + 4, y, { size: 9, color: [0.85, 0.15, 0.22] });
  pg.rightText(formatMoney(totals.paid), PAGE_W - MARGIN - 4, y, { size: 9, bold: true, color: [0.85, 0.15, 0.22] });
  y -= 24;
  pg.rule(MARGIN, y + 6, PAGE_W - MARGIN, y + 6, [0.82, 0.87, 0.93]);
  y -= 20;
  pg.text("Net balance", MARGIN + 4, y, { size: 10, bold: true });
  pg.rightText(formatMoney(totals.net), PAGE_W - MARGIN - 4, y, { size: 10, bold: true });

  y -= 50;
  pg.rule(MARGIN, y, PAGE_W - MARGIN, y, [0.82, 0.87, 0.93]);
  y -= 18;
  pg.text("This statement was generated by Campus Ride Sharing.", MARGIN, y, { size: 8, color: [0.45, 0.52, 0.6] });

  foot(pages[pages.length - 1]);
  triggerDownload(buildBlob(pages), "ride-transactions.pdf");
}

export function downloadTransactionReceiptPdf(t) {
  const page = new PdfPage();
  const W = page.width;
  const margin = 48;
  const labelX = margin;
  const valueX = margin + 170;
  let y = page.height - 120;

  page.bar(margin, page.height - 98, W - margin * 2, 6);
  y -= 20;
  page.text("PAYMENT RECEIPT", W / 2, y, { size: 20, bold: true });
  y -= 22;
  page.text("Campus Ride Sharing", W / 2, y, { size: 10 });
  y -= 12;
  page.text("Ride payment transaction receipt", W / 2, y, { size: 9, color: [0.45, 0.52, 0.6] });
  y -= 30;
  page.rule(margin, y, W - margin, y);

  const row = (label, value) => {
    y -= 26;
    page.text(label, labelX, y, { size: 9.5, color: [0.42, 0.48, 0.56] });
    page.text(value, valueX, y, { size: 9.5 });
  };

  const wrappedRow = (label, value) => {
    y -= 26;
    page.text(label, labelX, y, { size: 9.5, color: [0.42, 0.48, 0.56] });
    const wrap = page.wrappedText(value, valueX, y, { size: 9.5, maxWidth: W - margin - valueX });
    y -= wrap.lines * 14 - 26;
  };

  if (t.merged && t.receipts) {
    const refundTxn = t.receipts.find((r) => r.kind === "REFUND");
    const fineTxn = t.receipts.find((r) => r.kind === "FINE");

    y -= 10;
    row("Transaction IDs", `${refundTxn?.transactionId || "-"} / ${fineTxn?.transactionId || "-"}`);
    row("Type", "Refund + Cancellation Fine");
    row("Counterparty", t.counterparty?.name || "-");
    if (refundTxn?.ride) {
      wrappedRow("Departure Point", refundTxn.ride.pickup);
      wrappedRow("Destination", refundTxn.ride.dropoff);
      row("Departure Time", refundTxn.ride.departureTime);
    } else {
      row("Ride", "Cancellation fine (no ride link)");
    }
    row("Total Amount", formatMoney(t.amount));
    row("Payment Method", methodLabel(t.method));

    y -= 10;
    page.rule(margin, y, W - margin, y);
    y -= 20;
    page.text("ACTION DETAILS", labelX, y, { size: 10, bold: true });
    y -= 18;
    if (refundTxn) {
      page.text(`Refund amount: ${formatMoney(refundTxn.amount)}`, labelX, y, { size: 9 });
      y -= 16;
      page.text(`Refund transaction: ${refundTxn.transactionId || "-"}`, labelX, y, { size: 9, color: [0.42, 0.48, 0.56] });
      y -= 16;
    }
    if (fineTxn) {
      page.text(`Cancellation fine: ${formatMoney(fineTxn.amount)}`, labelX, y, { size: 9 });
      y -= 16;
      page.text(`Fine transaction: ${fineTxn.transactionId || "-"}`, labelX, y, { size: 9, color: [0.42, 0.48, 0.56] });
      y -= 16;
    }
    page.text(`Total: ${formatMoney(t.amount)}`, labelX, y, { size: 9, bold: true });
  } else {
    y -= 10;
    row("Transaction ID", t.method === "MANUAL" ? "None" : t.transactionId || "-");
    row("Type", t.kind === "FINE" ? "Cancellation Fine" : t.direction === "paid" ? "Paid out" : "Received");
    row("Counterparty", t.counterparty?.name || "-");
    if (t.ride) {
      wrappedRow("Departure Point", t.ride.pickup);
      wrappedRow("Destination", t.ride.dropoff);
      row("Departure Time", t.ride.departureTime);
    } else {
      row("Ride", t.kind === "FINE" ? "Cancellation fine (no ride link)" : "Manual / Offline due");
    }
    row("Amount", formatMoney(t.amount));
    row("Payment Method", methodLabel(t.method));
    row("Reference / Provider ID", t.providerTransactionId ? String(t.providerTransactionId) : "-");
    row("Date & Time", formatDate(t.createdAt));

    if (t.kind === "FINE") {
      y -= 10;
      page.rule(margin, y, W - margin, y);
      y -= 20;
      page.text("ACTION DETAILS", labelX, y, { size: 10, bold: true });
      y -= 18;
      page.text("Cancellation fine charged to driver for late ride cancellation.", labelX, y, { size: 9, color: [0.42, 0.48, 0.56] });
      y -= 16;
      page.text(`Fine amount: ${formatMoney(t.amount)}`, labelX, y, { size: 9 });
      y -= 16;
      page.text(`Total paid to passenger: ${formatMoney(t.amount)}`, labelX, y, { size: 9, bold: true });
    }
  }

  y -= 24;
  page.rule(margin, y, W - margin, y);
  y -= 24;
  page.text("Thank you. This receipt was generated by Campus Ride Sharing.", labelX, y, {
    size: 9,
    color: [0.45, 0.52, 0.6],
  });

  const filename = t.merged
    ? `receipt-refund-fine-${t.counterparty?.name || "transaction"}.pdf`
    : `receipt-${t.transactionId || "transaction"}.pdf`;
  triggerDownload(buildBlob([page]), filename);
}
