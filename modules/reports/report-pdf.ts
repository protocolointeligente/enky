import { existsSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import type { DocSection, ReportDocument } from "./report-document";

// Renderiza o ReportDocument em PDF com a identidade ENKY (Manual de Aplicação
// da Marca v1.0). Só DESENHA — toda a redação e as declarações de insuficiência
// vêm prontas do report-document, que é onde os testes travam o texto.
//
// Decisões de marca, com a seção do manual que as justifica:
//  - fundo claro no documento (§7.1: "usar fundos claros em documentos,
//    relatórios e telas de grande densidade de informação"), com faixa
//    azul-petróleo no topo carregando a marca;
//  - laranja reservado a destaque/estrutura, não a corpo de texto (§5.1: ~10%);
//  - turquesa para estado positivo e azul elétrico para dado (§1.1);
//  - wordmark é ARQUIVO, nunca refonte (§3.4: "não substituir a tipografia do
//    wordmark por uma fonte semelhante") — se o arquivo não estiver no bundle,
//    omitimos a marca em vez de recompor com Helvetica.

const BRAND = {
  petrol: "#062A38",
  orange: "#FF6500",
  electric: "#0066FF",
  turquoise: "#00D6C3",
  white: "#FFFFFF",
  lightGray: "#E6E8EB",
  ink: "#0B1F29",
  muted: "#5A6B75",
} as const;

const PAGE_MARGIN = 48;
const HEADER_HEIGHT = 96;
const FOOTER_HEIGHT = 42;

function brandAsset(file: string): string | null {
  const full = path.join(process.cwd(), "public", "brand", file);
  return existsSync(full) ? full : null;
}

type Doc = InstanceType<typeof PDFDocument>;

function contentWidth(doc: Doc): number {
  return doc.page.width - PAGE_MARGIN * 2;
}

// Faixa de marca no topo da primeira página.
function drawHeader(doc: Doc, document: ReportDocument): void {
  doc.save();
  doc.rect(0, 0, doc.page.width, HEADER_HEIGHT).fill(BRAND.petrol);
  // Fio laranja assinando a faixa (§5.1 — laranja como ativação, não como base).
  doc.rect(0, HEADER_HEIGHT - 3, doc.page.width, 3).fill(BRAND.orange);

  const symbol = brandAsset("enky-symbol.png");
  const wordmark = brandAsset("enky-wordmark-ondark.png");
  let cursorX = PAGE_MARGIN;

  if (symbol) {
    doc.image(symbol, cursorX, 30, { height: 26 });
    cursorX += 34;
  }
  if (wordmark) {
    doc.image(wordmark, cursorX, 37, { height: 14 });
  }

  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor(BRAND.lightGray)
    .text("INTELIGÊNCIA PARA CADA DECISÃO.", PAGE_MARGIN, 62, {
      width: contentWidth(doc),
      characterSpacing: 1.2,
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(BRAND.white)
    .text("RELATÓRIO DE PERÍODO", PAGE_MARGIN, 40, {
      width: contentWidth(doc),
      align: "right",
      characterSpacing: 1,
    });
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(BRAND.lightGray)
    .text(document.periodLabel, PAGE_MARGIN, 54, { width: contentWidth(doc), align: "right" });

  doc.restore();
}

function drawTitleBlock(doc: Doc, document: ReportDocument): void {
  doc.y = HEADER_HEIGHT + 26;

  doc
    .font("Helvetica-Bold")
    .fontSize(22)
    .fillColor(BRAND.petrol)
    .text(document.athleteName, PAGE_MARGIN, doc.y, { width: contentWidth(doc) });

  doc.moveDown(0.3);
  doc
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor(BRAND.muted)
    .text(
      `Período de ${document.periodLabel}  ·  ${document.generatedLabel}  ·  Treinador: ${document.trainerName}`,
      { width: contentWidth(doc) },
    );

  drawStatusPill(doc, document.statusLabel);
  doc.moveDown(1.2);
}

function drawStatusPill(doc: Doc, label: string): void {
  const paddingX = 8;
  doc.font("Helvetica-Bold").fontSize(7.5);
  const width = doc.widthOfString(label.toUpperCase(), { characterSpacing: 0.8 }) + paddingX * 2;
  const y = doc.y + 8;

  doc.save();
  doc.roundedRect(PAGE_MARGIN, y, width, 15, 7.5).fill(BRAND.lightGray);
  doc
    .fillColor(BRAND.petrol)
    .text(label.toUpperCase(), PAGE_MARGIN + paddingX, y + 4.5, { characterSpacing: 0.8 });
  doc.restore();
  doc.y = y + 15;
}

// Quebra de página que preserva a margem de rodapé.
function ensureSpace(doc: Doc, needed: number): void {
  if (doc.y + needed > doc.page.height - PAGE_MARGIN - FOOTER_HEIGHT) {
    doc.addPage();
    doc.y = PAGE_MARGIN;
  }
}

function drawSectionTitle(doc: Doc, title: string): void {
  ensureSpace(doc, 46);
  doc.moveDown(0.8);
  const y = doc.y;
  // Marcador laranja à esquerda do título — estrutura, não decoração.
  doc
    .save()
    .rect(PAGE_MARGIN, y + 1, 3, 13)
    .fill(BRAND.orange)
    .restore();
  doc
    .font("Helvetica-Bold")
    .fontSize(12.5)
    .fillColor(BRAND.petrol)
    .text(title, PAGE_MARGIN + 10, y, { width: contentWidth(doc) - 10 });
  doc.moveDown(0.5);
}

function drawStats(doc: Doc, stats: DocSection["stats"]): void {
  if (stats.length === 0) return;

  const gap = 8;
  const perRow = Math.min(stats.length, 4);
  const cardW = (contentWidth(doc) - gap * (perRow - 1)) / perRow;
  const cardH = 46;

  for (let i = 0; i < stats.length; i += perRow) {
    const row = stats.slice(i, i + perRow);
    ensureSpace(doc, cardH + gap);
    const top = doc.y;

    row.forEach((stat, index) => {
      const x = PAGE_MARGIN + index * (cardW + gap);
      doc.save();
      doc.roundedRect(x, top, cardW, cardH, 6).fill(BRAND.lightGray);
      doc
        .font("Helvetica-Bold")
        .fontSize(6.5)
        .fillColor(BRAND.muted)
        .text(stat.label.toUpperCase(), x + 9, top + 8, {
          width: cardW - 18,
          characterSpacing: 0.7,
        });
      doc
        .font("Helvetica-Bold")
        .fontSize(15)
        .fillColor(BRAND.petrol)
        .text(stat.value, x + 9, top + 19, { width: cardW - 18, lineBreak: false });
      if (stat.note) {
        doc
          .font("Helvetica")
          .fontSize(6.5)
          .fillColor(BRAND.electric)
          .text(stat.note, x + 9, top + 35, { width: cardW - 18, lineBreak: false });
      }
      doc.restore();
    });

    doc.y = top + cardH + gap;
  }
}

function drawRows(doc: Doc, rows: DocSection["rows"]): void {
  if (rows.length === 0) return;
  doc.moveDown(0.2);

  rows.forEach((row, index) => {
    doc.font("Helvetica").fontSize(9);
    const labelW = contentWidth(doc) * 0.42;
    const valueW = contentWidth(doc) - labelW - 12;
    const height =
      Math.max(
        doc.heightOfString(row.label, { width: labelW }),
        doc.heightOfString(row.value, { width: valueW }),
      ) + 9;

    ensureSpace(doc, height);
    const top = doc.y;

    if (index % 2 === 0) {
      doc
        .save()
        .rect(PAGE_MARGIN - 4, top - 2, contentWidth(doc) + 8, height)
        .fill("#F4F6F7")
        .restore();
    }

    doc.fillColor(BRAND.muted).text(row.label, PAGE_MARGIN, top + 2, { width: labelW });
    doc
      .font("Helvetica-Bold")
      .fillColor(BRAND.ink)
      .text(row.value, PAGE_MARGIN + labelW + 12, top + 2, { width: valueW });

    doc.y = top + height;
  });
  doc.moveDown(0.3);
}

function drawParagraphs(doc: Doc, paragraphs: string[]): void {
  paragraphs.forEach((text) => {
    doc.font("Helvetica").fontSize(9.5);
    const height = doc.heightOfString(text, { width: contentWidth(doc), lineGap: 1.5 });
    ensureSpace(doc, height + 6);
    doc
      .fillColor(BRAND.ink)
      .text(text, PAGE_MARGIN, doc.y, { width: contentWidth(doc), lineGap: 1.5, align: "justify" });
    doc.moveDown(0.5);
  });
}

// Declaração de insuficiência — destacada, porque é informação de primeira
// classe no ENKY, não uma nota de rodapé envergonhada.
function drawNotice(doc: Doc, notice: string): void {
  doc.font("Helvetica").fontSize(8.5);
  const innerW = contentWidth(doc) - 22;
  const height = doc.heightOfString(notice, { width: innerW, lineGap: 1.2 }) + 16;

  ensureSpace(doc, height + 6);
  const top = doc.y;

  doc.save();
  doc.roundedRect(PAGE_MARGIN, top, contentWidth(doc), height, 5).fill("#F0FBFA");
  doc.rect(PAGE_MARGIN, top, 3, height).fill(BRAND.turquoise);
  doc
    .fillColor(BRAND.petrol)
    .text(notice, PAGE_MARGIN + 14, top + 8, { width: innerW, lineGap: 1.2 });
  doc.restore();

  doc.y = top + height;
  doc.moveDown(0.5);
}

function drawSection(doc: Doc, section: DocSection): void {
  drawSectionTitle(doc, section.title);
  drawStats(doc, section.stats);
  drawParagraphs(doc, section.paragraphs);
  drawRows(doc, section.rows);
  if (section.notice) drawNotice(doc, section.notice);
}

// Rodapé em todas as páginas: a ressalva de não-diagnóstico viaja com o PDF
// mesmo que alguém imprima uma página solta.
function drawFooters(doc: Doc, document: ReportDocument): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const y = doc.page.height - FOOTER_HEIGHT;

    doc.save();
    doc
      .moveTo(PAGE_MARGIN, y)
      .lineTo(doc.page.width - PAGE_MARGIN, y)
      .lineWidth(0.5)
      .strokeColor(BRAND.lightGray)
      .stroke();
    doc
      .font("Helvetica")
      .fontSize(6.5)
      .fillColor(BRAND.muted)
      .text(
        `ENKY · ${document.athleteName} · ${document.periodLabel} · Leitura de contexto, não diagnóstico.`,
        PAGE_MARGIN,
        y + 8,
        { width: contentWidth(doc) - 60 },
      );
    doc
      .font("Helvetica-Bold")
      .fontSize(6.5)
      .fillColor(BRAND.petrol)
      .text(`${i - range.start + 1}/${range.count}`, PAGE_MARGIN, y + 8, {
        width: contentWidth(doc),
        align: "right",
      });
    doc.restore();
  }
}

/**
 * Renderiza o documento em bytes de PDF. `bufferPages` fica ligado para o
 * rodapé conseguir numerar depois de saber o total de páginas.
 */
export function renderReportPdf(document: ReportDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: PAGE_MARGIN,
      bufferPages: true,
      info: {
        Title: `Relatório ENKY — ${document.athleteName} — ${document.periodLabel}`,
        Author: `ENKY · ${document.trainerName}`,
        Subject: "Relatório de período — leitura de contexto, não diagnóstico.",
        Creator: "ENKY OS",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      drawHeader(doc, document);
      drawTitleBlock(doc, document);
      document.sections.forEach((section) => drawSection(doc, section));
      drawFooters(doc, document);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export function reportPdfFilename(document: ReportDocument): string {
  const slug = document.athleteName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const period = document.periodLabel.replace(/\//g, "-").replace(/\s+a\s+/, "_");
  return `enky-relatorio-${slug || "atleta"}-${period}.pdf`;
}
