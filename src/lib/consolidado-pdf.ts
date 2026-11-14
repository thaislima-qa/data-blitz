import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { celula, colunaNumerica, fmtDate, norm, fmtMonth, fmtMoney, methodLabel, type Linha, type Relatorio } from "@/lib/consolidado";

const money = (v: number) => fmtMoney(v).replace(/ /g, " ");
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Carrega a imagem; se falhar, devolve null e o PDF sai sem ela em vez de quebrar. */
const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { console.warn("Não consegui carregar a imagem do PDF"); resolve(null); };
    img.src = src;
  });


/** selo: logo quadrado da capa. horizontal: logo largo dos cabeçalhos. Ambos em data URL (import "?inline"). */
export async function gerarConsolidadoPDF(r: Relatorio, studio: string, seloSrc: string, horizontalSrc: string, colunas: string[]) {
  const [selo, logo] = await Promise.all([loadImage(seloSrc), loadImage(horizontalSrc)]);
  const logoRatio = logo ? logo.naturalHeight / logo.naturalWidth : 0.249;
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
  const sz = 200, ix = (W - sz) / 2, iy = 58;
  doc.setFillColor(255, 255, 255); doc.rect(ix - 9, iy - 9, sz + 18, sz + 18, "F");
  if (selo) doc.addImage(selo, "PNG", ix, iy, sz, sz);
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(17);
  doc.text(`Prestação de Contas - ${cfg.sede} - ${fmtMonth(cfg.ref)}`, W / 2, H * 0.64, { align: "center" });
  doc.setFontSize(14); doc.text(studio, W / 2, H * 0.74, { align: "center" });
  doc.setDrawColor(255, 255, 255); doc.setLineWidth(2.5); doc.line(W * 0.17, H * 0.775, W * 0.83, H * 0.775);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(gerado, W / 2, H * 0.81, { align: "center" });

  // Resumo
  doc.addPage(); doc.setTextColor(0, 0, 0);
  if (logo) doc.addImage(logo, "PNG", W - 40 - 150, 20, 150, 150 * logoRatio);
  const x0 = 40, wT = W - 80 - 110, wV = 150; // tabela centralizada
  const mesNome = new Date(`${cfg.ref}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long" });
  const mesCap = mesNome.charAt(0).toUpperCase() + mesNome.slice(1);
  const curto = `${mesNome.slice(0, 3).toUpperCase()}/${cfg.ref.slice(2, 4)}`;
  const curtoMin = `${mesNome.slice(0, 3).charAt(0).toUpperCase()}${mesNome.slice(1, 3)}/${cfg.ref.slice(2, 4)}`;
  const rs = r.resumo;
  let y = 84;
  const H1 = 19;
  type RGB = [number, number, number];
  const faixa = (txt: string, val: string | null, fill: RGB, txtColor: RGB = [0, 0, 0], bold = true, centro = false) => {
    doc.setFillColor(...fill); doc.rect(x0, y, wT, H1, "F");
    doc.setDrawColor(40, 40, 40); doc.setLineWidth(0.5); doc.rect(x0, y, wT, H1);
    if (val !== null) doc.line(x0 + wT - wV, y, x0 + wT - wV, y + H1);
    doc.setTextColor(...txtColor); doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(9.5);
    if (centro) doc.text(txt, x0 + wT / 2, y + 13, { align: "center" });
    else doc.text(txt, x0 + 6, y + 13);
    if (val !== null) doc.text(val, x0 + wT - 6, y + 13, { align: "right" });
    y += H1;
  };
  const titulo = (txt: string) => {
    doc.setFillColor(204, 204, 204); doc.rect(x0, y, wT, 26, "F"); doc.setDrawColor(40, 40, 40); doc.rect(x0, y, wT, 26);
    doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text(txt, x0 + wT / 2, y + 18, { align: "center" }); y += 26;
  };
  const BR = (v: number) => money(v);
  titulo(`Consolidado ${mesCap} ${cfg.ref.slice(0, 4)} · ${cfg.sede}`);
  faixa(`MENSALIDADES ${curto}`, BR(rs.mensalidades), [74, 134, 232], [255, 255, 255]);
  faixa(`Adimplentes ${curtoMin} + Inadimplentes Meses Anteriores`, BR(rs.adimplentesMaisAnteriores), [207, 226, 243]);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(60, 60, 60); doc.text("Total Distribuição", x0 + wT + 6, y - 7);
  faixa("Inadimplentes", BR(rs.inadimplentes), [244, 204, 204]);
  y += 12;
  faixa("RECEBIMENTOS (Adimplentes)", null, [0, 255, 0], [0, 0, 0], true, true);
  faixa("Recebimentos via Cartão", BR(rs.cartao), [255, 255, 255], [0, 0, 0], false);
  faixa("Recebimentos via PIX & Dinheiro", BR(rs.pixDinheiro), [255, 255, 255], [0, 0, 0], false);
  faixa("Recebimentos Inadimplentes Meses Anteriores", BR(rs.inadAnteriores), [255, 255, 255], [0, 0, 0], false);
  y += 12;
  faixa("DESCONTOS", null, [255, 0, 0], [255, 255, 255], true, true);
  faixa(`Taxa Cartão (${String(rs.taxaPct).replace(".", ",")}%)`, BR(rs.taxaCartao), [255, 255, 255], [0, 0, 0], false);
  faixa(`Impostos (Simples Nacional ${String(rs.impostoPct).replace(".", ",")}%)*`, BR(rs.impostos), [255, 255, 255], [0, 0, 0], false);
  doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(60, 60, 60);
  doc.text("* Alíquota sujeita a alteração a depender do faturamento anual", x0 + wT + 6, y - 14, { maxWidth: 100 });
  y += 12;
  faixa("Valor a distribuir (Recebimentos - Descontos)", BR(rs.valorDistribuir), [39, 78, 19], [255, 255, 255]);
  const cores: RGB[] = [[153, 0, 255], [61, 133, 198], [230, 145, 56], [106, 168, 79]];
  rs.partes.forEach((pt, i) => faixa(`${pt.nome} (${String(pt.pct).replace(".", ",")}%)`, BR(pt.valor), cores[i % cores.length], [255, 255, 255]));
  y += 12;
  const cinza: RGB = [102, 102, 102];
  faixa(`Alunos ativos em ${curtoMin}`, String(r.alunos.ativos), cinza, [255, 255, 255]);
  faixa(`Alunos adimplentes`, String(r.alunos.adimp), cinza, [255, 255, 255]);
  faixa(`Alunos inadimplentes`, String(r.alunos.inad), cinza, [255, 255, 255]);
  doc.setFillColor(0, 0, 128); doc.rect(40, H - 52, W - 80, 4, "F");

  // Detalhes
  doc.addPage(); doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(0, 0, 0); doc.text("DADOS DETALHADOS", 40, 56);
  let Y = 84;
  const common = {
    theme: "grid" as const,
    styles: { fontSize: 7.5, cellPadding: 4, lineColor: [220, 220, 230] as [number, number, number], textColor: [20, 20, 30] as [number, number, number], overflow: "linebreak" as const },
    headStyles: { fillColor: [236, 232, 244] as [number, number, number], textColor: [60, 50, 80] as [number, number, number], fontStyle: "bold" as const },
    margin: { left: 40, right: 40, top: 60, bottom: 40 },
    didDrawPage: () => { if (logo) doc.addImage(logo, "PNG", W - 40 - 110, 16, 110, 110 * logoRatio); },
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
  Y = finalY() + 26;

  // Valores e datas com largura fixa para não quebrar em duas linhas.
  const estilos = (cols: string[]) => {
    const st: Record<number, { halign?: "right"; cellWidth: number }> = {};
    cols.forEach((c, i) => {
      if (colunaNumerica(c)) st[i] = { halign: "right", cellWidth: 64 };
      else if (norm(c).startsWith("data")) st[i] = { cellWidth: 58 };
    });
    return st;
  };
  const tabela = (linhas: Linha[], vazio: string, vermelho: boolean, cols: string[] = colunas) =>
    autoTable(doc, {
      ...common, startY: Y + 4, columnStyles: estilos(cols), head: [cols],
      body: linhas.length ? linhas.map((x) => cols.map((c) => celula(x, c))) : [[vazio, ...cols.slice(1).map(() => "")]],
      didParseCell: (d) => { if (vermelho && d.section === "body" && linhas.length) d.cell.styles.textColor = [196, 36, 36]; },
    });

  title("Inadimplentes do Mês", `${r.mensais.abertas.length} mensalidade(s) com vencimento em ${fmtMonth(cfg.ref)} ainda em aberto · ${money(r.mensais.aberto)}`);
  tabela(r.mensais.abertas, "Nenhuma mensalidade em aberto neste mês", true, ["Cliente", "Descrição", "Valor"]);
  Y = finalY() + 26;

  title("Inadimplentes Recebidos", `Mensalidades de meses anteriores recebidas entre ${fmtDate(cfg.cutStart)} e ${fmtDate(cfg.cutEnd)} · ${money(r.inad.total)}`);
  tabela(r.inad.rows, "Nenhum recebimento atrasado no período", false);
  Y = finalY() + 26;

  title("Planos Mensais Ativos no Período", `${r.mensais.pagas.length} mensalidade(s) recebidas com vencimento em ${fmtMonth(cfg.ref)} · ${money(r.mensais.recebido)}`);
  tabela(r.mensais.pagas, "Nenhuma mensalidade recebida neste mês", false);

  const n = doc.getNumberOfPages();
  for (let p = 3; p <= n; p++) {
    doc.setPage(p); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(110, 110, 120);
    doc.text(`Página ${p - 1} de ${n - 1} · ${cfg.sede} · ${fmtMonth(cfg.ref)}`, W - 40, H - 18, { align: "right" });
  }
  const nome = `Consolidado-${cfg.sede.replace(/\s+/g, "-")}-${cfg.ref.slice(5, 7)}-${cfg.ref.slice(0, 4)}.pdf`;
  return { blob: doc.output("blob") as Blob, nome };
}
