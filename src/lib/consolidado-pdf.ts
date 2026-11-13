import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtDate, fmtMonth, fmtMoney, methodLabel, type Linha, type Relatorio } from "@/lib/consolidado";

const money = (v: number) => fmtMoney(v).replace(/ /g, " ");
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const shortDesc = (d: string) => d.replace(/\s*\[Moove [^\]]*\]/gi, "").trim() || d;

export async function gerarConsolidadoPDF(r: Relatorio, studio: string, logoCoverSrc: string, logoHeaderSrc: string) {
  const [cover, logo] = await Promise.all([loadImage(logoCoverSrc), loadImage(logoHeaderSrc)]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const { cfg } = r;
  const now = new Date();
  const gerado = `Gerado em ${now.getDate()} de ${MESES[now.getMonth()]} de ${now.getFullYear()}`;

  // Capa
  doc.setFillColor(138, 43, 226); doc.rect(0, 0, W, H / 3, "F");
  doc.setFillColor(99, 25, 181); doc.rect(0, H / 3, W, H / 3, "F");
  doc.setFillColor(79, 15, 150); doc.rect(0, (2 * H) / 3, W, H / 3, "F");
  const iw = 300, ih = (iw * 418) / 739, ix = (W - iw) / 2, iy = 72;
  doc.setFillColor(255, 255, 255); doc.rect(ix - 9, iy - 9, iw + 18, ih + 18, "F");
  doc.addImage(cover, "PNG", ix, iy, iw, ih);
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(17);
  doc.text(`Prestação de Contas - ${cfg.sede} - ${fmtMonth(cfg.ref)}`, W / 2, H * 0.64, { align: "center" });
  doc.setFontSize(14); doc.text(studio, W / 2, H * 0.74, { align: "center" });
  doc.setDrawColor(255, 255, 255); doc.setLineWidth(2.5); doc.line(W * 0.17, H * 0.775, W * 0.83, H * 0.775);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(gerado, W / 2, H * 0.81, { align: "center" });

  // Resumo
  doc.addPage(); doc.setTextColor(0, 0, 0);
  try {
    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
    doc.addImage(logo, "PNG", W / 2 - 130, H / 2 - 150, 260, 260);
    doc.restoreGraphicsState();
  } catch { /* marca d'água é opcional */ }
  doc.addImage(logo, "PNG", W - 110, 28, 64, 64);
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text(`Relatório Consolidado - ${fmtMonth(cfg.ref)}`, 40, 60);
  let y = 112;
  const head = (t: string) => { doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(0, 0, 0); doc.text(t, 40, y); y += 22; };
  const total = (t: string, c: [number, number, number]) => { doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(...c); doc.text(t, 56, y); y += 20; };
  const sub = (t: string) => { doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(0, 0, 0); doc.text(t, 76, y); y += 19; };
  head("Planos Mensais:"); total(`Total Recebido: ${money(r.mensais.recebido)}`, [0, 100, 0]);
  r.mensais.porMetodo.forEach(([m, v]) => sub(`${m}: ${money(v)}`)); y += 8;
  head("Planos Ativos:"); total(`Total Recebido: ${money(r.planos.recebido)}`, [0, 100, 0]);
  r.planos.porMetodo.forEach(([m, v]) => sub(`${m}: ${money(v)}`)); y += 10;
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(255, 31, 31);
  doc.text(`Inadimplentes Recebimentos: ${money(r.inad.total)}`, 40, y); y += 25;
  doc.text(`Valor em Aberto: ${money(r.totais.aberto)}`, 40, y); y += 35;
  doc.setTextColor(0, 0, 128); doc.setFontSize(15); doc.text(`Total Geral: ${money(r.totais.geral)}`, 40, y); y += 26;
  doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "italic"); doc.setFontSize(12);
  doc.text(`Total Distribuição: ${money(r.totais.distribuicao)}*`, 40, y); y += 12;
  doc.setFontSize(6.5); doc.text("*Valor antes da dedução dos impostos", 40, y);
  doc.setFillColor(0, 0, 128); doc.rect(40, H - 52, W - 80, 4, "F");

  // Detalhes
  doc.addPage(); doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(0, 0, 0); doc.text("DADOS DETALHADOS", 40, 56);
  let Y = 84;
  const common = {
    theme: "grid" as const,
    styles: { fontSize: 7.5, cellPadding: 4, lineColor: [220, 220, 230] as [number, number, number], textColor: [20, 20, 30] as [number, number, number], overflow: "linebreak" as const },
    headStyles: { fillColor: [236, 232, 244] as [number, number, number], textColor: [60, 50, 80] as [number, number, number], fontStyle: "bold" as const },
    margin: { left: 40, right: 40, top: 60, bottom: 40 },
    didDrawPage: () => { try { doc.addImage(logo, "PNG", W - 80, 14, 36, 36); } catch { /* sem logo */ } },
  };
  const finalY = () => (doc as any).lastAutoTable.finalY as number;
  const title = (t: string, extra?: string) => {
    if (Y > H - 130) { doc.addPage(); Y = 70; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(0, 0, 0); doc.text(t, 40, Y); Y += 16;
    if (extra) { doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(extra, 40, Y); Y += 8; }
  };

  title("Planos de Assinatura Ativos no Período",
    `Total de Planos: ${r.planos.rows.length}   Trimestral: ${r.planos.nTri} | Semestral: ${r.planos.nSem}${r.planos.nAnu ? ` | Anual: ${r.planos.nAnu}` : ""}`);
  autoTable(doc, {
    ...common, startY: Y + 4,
    columnStyles: { 2: { cellWidth: 62 }, 3: { cellWidth: 100 }, 4: { cellWidth: 62 } },
    head: [["Tipo", "Cliente", "Vencimento", "Período", "Valor", "Método de pagamento"]],
    body: r.planos.rows.map((p) => [p.tipo, p.cliente, fmtDate(p.venc), `${fmtMonth(p.de)} a ${fmtMonth(p.ate)}`, money(p.valor), methodLabel(p.metodo, true) + (p.aberto ? " (em aberto)" : "")]),
  });
  Y = finalY() + 22;
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(0, 0, 0);
  doc.text(`Total de Alunos Ativos: ${r.alunos.ativos}`, 40, Y);
  doc.setFont("helvetica", "normal"); doc.text(`Adimplentes: ${r.alunos.adimp}   Inadimplentes: ${r.alunos.inad}`, 40, Y + 14);
  Y += 44;

  const rowHead = ["Cliente", "Descrição", "Vencimento", "Recebimento", "Valor", "Valor recebido", "Método de pagamento", "Situação"];
  const rowMap = (x: Linha) => [x.cliente, shortDesc(x.desc), fmtDate(x.venc), fmtDate(x.rec), money(x.valor), x.sit === "Recebido" ? money(x.recebido) : "", x.metodo, x.sit];
  const colW = { columnStyles: { 2: { cellWidth: 56 }, 3: { cellWidth: 56 }, 4: { cellWidth: 56 }, 5: { cellWidth: 56 } } };

  title("Inadimplentes Recebidos");
  autoTable(doc, {
    ...common, ...colW, startY: Y + 4, head: [rowHead],
    body: r.inad.rows.length ? r.inad.rows.map(rowMap) : [["Nenhum recebimento atrasado no período", "", "", "", "", "", "", ""]],
  });
  Y = finalY() + 26;

  title("Planos Mensais Ativos no Período");
  autoTable(doc, {
    ...common, ...colW, startY: Y + 4, head: [[...rowHead, "Consultor"]],
    body: r.mensais.rows.map((x) => [...rowMap(x), x.consultor]),
    didParseCell: (d) => { if (d.section === "body" && (d.row.raw as string[])[7] !== "Recebido") d.cell.styles.textColor = [196, 36, 36]; },
  });

  const n = doc.getNumberOfPages();
  for (let p = 3; p <= n; p++) {
    doc.setPage(p); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(110, 110, 120);
    doc.text(`Página ${p - 1} de ${n - 1} · ${cfg.sede} · ${fmtMonth(cfg.ref)}`, W - 40, H - 18, { align: "right" });
  }
  doc.save(`Consolidado-${cfg.sede.replace(/\s+/g, "-")}-${cfg.ref.slice(5, 7)}-${cfg.ref.slice(0, 4)}.pdf`);
}
