import { fmtMonth, norm } from "@/lib/consolidado";

export interface MetaPDF { sede: string; ref: string; alunos: { nome: string; detalhe: string }[]; ativos: number; inad: number }
export interface Comparacao {
  anterior: MetaPDF; atual: MetaPDF;
  entradas: { nome: string; detalhe: string }[];
  saidas: { nome: string; detalhe: string }[];
}

/** Lê os dados embutidos pelo gerador de consolidado no campo Keywords do PDF. */
export async function lerMetaPDF(file: File): Promise<MetaPDF> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let txt = "";
  for (let i = 0; i < buf.length; i += 0x8000) txt += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const m = txt.match(/CONSOLIDADO-DATA:([A-Za-z0-9+/=]+)/);
  if (!m) throw new Error(`"${file.name}" não tem os dados do consolidado. Gere o PDF de novo pelo sistema (versão mais recente) e tente outra vez.`);
  try {
    const j = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
    if (!j.ref || !Array.isArray(j.alunos)) throw new Error();
    return j as MetaPDF;
  } catch {
    throw new Error(`Não consegui ler os dados de "${file.name}".`);
  }
}

/** Ordena pelo mês de referência (o mais antigo vira "anterior") e compara os alunos ativos. */
export function comparar(a: MetaPDF, b: MetaPDF): Comparacao {
  const [anterior, atual] = a.ref <= b.ref ? [a, b] : [b, a];
  const antes = new Map(anterior.alunos.map((x) => [norm(x.nome), x]));
  const depois = new Map(atual.alunos.map((x) => [norm(x.nome), x]));
  return {
    anterior, atual,
    entradas: [...depois].filter(([k]) => !antes.has(k)).map(([, v]) => v),
    saidas: [...antes].filter(([k]) => !depois.has(k)).map(([, v]) => v),
  };
}

const carregar = (src: string) => new Promise<HTMLImageElement | null>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

/** Desenha a imagem (PNG) com as listas de entradas e saídas. */
export async function gerarImagemComparacao(c: Comparacao, logoSrc: string): Promise<Blob> {
  const logo = await carregar(logoSrc);
  const S = 2, W = 1400, pad = 48, colW = (W - pad * 2 - 32) / 2;
  const linhaH = 46, topo = 250;
  const n = Math.max(c.entradas.length, c.saidas.length, 1);
  const H = topo + 64 + n * linhaH + 130;
  const cv = document.createElement("canvas"); cv.width = W * S; cv.height = H * S;
  const g = cv.getContext("2d")!; g.scale(S, S);
  const F = "Helvetica, Arial, sans-serif";

  g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#000000"; g.fillRect(0, 0, W, 110);
  if (logo) { const lw = 240, lh = lw * (logo.naturalHeight / logo.naturalWidth); g.drawImage(logo, pad, 55 - lh / 2, lw, lh); }
  g.fillStyle = "#ffffff"; g.font = `bold 26px ${F}`; g.textAlign = "right"; g.textBaseline = "middle";
  g.fillText("Entradas e Saídas de Alunos", W - pad, 55);

  g.textAlign = "left"; g.textBaseline = "alphabetic";
  g.fillStyle = "#3f1a74"; g.font = `bold 34px ${F}`;
  g.fillText(`${c.atual.sede} · ${fmtMonth(c.anterior.ref)} → ${fmtMonth(c.atual.ref)}`, pad, 170);
  g.fillStyle = "#555566"; g.font = `20px ${F}`;
  const saldo = c.atual.ativos - c.anterior.ativos;
  g.fillText(`Alunos ativos: ${c.anterior.ativos} em ${fmtMonth(c.anterior.ref)} → ${c.atual.ativos} em ${fmtMonth(c.atual.ref)}  (saldo ${saldo > 0 ? "+" : ""}${saldo})`, pad, 208);

  const coluna = (x: number, titulo: string, lista: { nome: string; detalhe: string }[], cor: string, zebra: string, vazio: string) => {
    g.fillStyle = cor; g.fillRect(x, topo, colW, 52);
    g.fillStyle = "#ffffff"; g.font = `bold 22px ${F}`; g.textBaseline = "middle"; g.textAlign = "left";
    g.fillText(titulo, x + 18, topo + 27);
    g.textAlign = "right"; g.fillText(String(lista.length), x + colW - 18, topo + 27);
    g.textAlign = "left";
    if (!lista.length) { g.fillStyle = "#777788"; g.font = `italic 18px ${F}`; g.fillText(vazio, x + 18, topo + 52 + 28); return; }
    lista.forEach((a, i) => {
      const y = topo + 52 + i * linhaH;
      g.fillStyle = i % 2 ? "#ffffff" : zebra; g.fillRect(x, y, colW, linhaH);
      g.fillStyle = "#1e1e2a"; g.font = `18px ${F}`;
      g.fillText(recorta(g, a.nome, colW * 0.55), x + 18, y + linhaH / 2);
      g.fillStyle = "#777788"; g.font = `14px ${F}`; g.textAlign = "right";
      g.fillText(recorta(g, a.detalhe, colW * 0.38), x + colW - 18, y + linhaH / 2); g.textAlign = "left";
    });
  };
  const recorta = (ctx: CanvasRenderingContext2D, t: string, max: number) => {
    if (ctx.measureText(t).width <= max) return t;
    while (t.length > 1 && ctx.measureText(t + "…").width > max) t = t.slice(0, -1);
    return t + "…";
  };
  coluna(pad, "ENTRADAS (novos alunos)", c.entradas, "#1e8c46", "#effaf3", "Nenhuma entrada");
  coluna(pad + colW + 32, "SAÍDAS (não estão mais ativos)", c.saidas, "#c82828", "#fdf1f1", "Nenhuma saída");

  g.textBaseline = "alphabetic"; g.fillStyle = "#888899"; g.font = `14px ${F}`; g.textAlign = "left";
  g.fillText(`Comparação dos consolidados de ${fmtMonth(c.anterior.ref)} e ${fmtMonth(c.atual.ref)} · gerado em ${new Date().toLocaleDateString("pt-BR")}`, pad, H - 40);

  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("Não consegui gerar a imagem"))), "image/png"));
}
