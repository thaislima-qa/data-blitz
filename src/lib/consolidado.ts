/**
 * Regras do Consolidado Mensal (puras, sem DOM nem Supabase).
 *
 * - Sede vem do texto do contrato (coluna "Descrição"), nunca do consultor.
 * - Planos mensais: vencimento no mês de referência, recebidos em qualquer data.
 * - Inadimplentes recebidos: mensalidades de meses anteriores recebidas dentro do período de corte.
 * - Planos trimestrais/semestrais: só vêm na planilha do mês em que começam. Viram "contratos"
 *   que o app guarda (tabela plan_contracts) e usa nos meses seguintes.
 */

export const SEDES = ['Maraponga', 'Fátima', 'Sala Interativa'] as const;
export type Sede = (typeof SEDES)[number];

export type TipoPlano = 'Trimestral' | 'Semestral' | 'Anual';
export type Tipo = 'Mensal' | TipoPlano | 'Outro';

export const PLAN_MESES: Record<TipoPlano, number> = { Trimestral: 3, Semestral: 6, Anual: 12 };
/** Abaixo disso o valor da parcela já é o valor mensal (ex.: 1/3 de R$ 150). */
const MIN_MENSALIDADE = 100;

export interface Linha {
  cliente: string;
  desc: string;
  venc: string; // YYYY-MM-DD
  rec: string | null;
  valor: number;
  recebido: number;
  metodo: string;
  parcelas: string;
  sit: 'Recebido' | 'Aberto' | 'Cancelado';
  consultor: string;
  sede: Sede | null;
  tipo: Tipo;
}

export interface Contrato {
  key: string;
  cliente: string;
  sede: Sede;
  tipo: TipoPlano;
  start: string; // YYYY-MM
  N: number;
  venc: string; // YYYY-MM-DD
  mensal: number;
  metodo: string;
  consultor: string;
  /** mês (YYYY-MM) -> true se a parcela daquele mês está em aberto */
  st: Record<string, boolean>;
  manual?: boolean;
}

export interface PlanoAtivo {
  key: string;
  tipo: TipoPlano;
  cliente: string;
  venc: string;
  de: string;
  ate: string;
  valor: number;
  metodo: string;
  aberto: boolean;
  manual: boolean;
}

export interface Config {
  sede: Sede;
  ref: string; // YYYY-MM
  cutStart: string; // YYYY-MM-DD
  cutEnd: string; // YYYY-MM-DD
}

export interface Relatorio {
  cfg: Config;
  mensais: { rows: Linha[]; recebido: number; porMetodo: [string, number][]; aberto: number; nAberto: number };
  inad: { rows: Linha[]; total: number };
  planos: { rows: PlanoAtivo[]; recebido: number; porMetodo: [string, number][]; nTri: number; nSem: number; nAnu: number };
  alunos: { ativos: number; adimp: number; inad: number };
  totais: { aberto: number; distribuicao: number; geral: number };
  diag: {
    linhas: number;
    porSede: [Sede, number][];
    semSede: number;
    semSedeValor: number;
    semSedeLista: [string, number][];
    prevFora: { n: number; total: number };
    prevAberto: { n: number; total: number };
  };
}

/* ---------- utilitários ---------- */

export const norm = (s: unknown): string =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const pad = (n: number | string) => String(n).padStart(2, '0');
const isoFromUTC = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export function toISO(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isoFromUTC(new Date(v.getTime() + 12 * 3600e3));
  if (typeof v === 'number') return isoFromUTC(new Date(Math.round((v - 25569) * 864e5)));
  const s = String(v).trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function toNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (v == null || v === '') return 0;
  let s = String(v).replace(/[R$\s]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

export function addMonths(ym: string, k: number): string {
  let y = +ym.slice(0, 4);
  let m = +ym.slice(5, 7) - 1 + k;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  return `${y}-${pad(m + 1)}`;
}

export const fmtDate = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
export const fmtMonth = (ym: string) => `${ym.slice(5, 7)}/${ym.slice(0, 4)}`;
export const fmtMoney = (v: number) =>
  'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function detectSede(desc: string): Sede | null {
  const n = norm(desc);
  if (/marapo/.test(n)) return 'Maraponga';
  if (/fatima/.test(n)) return 'Fátima';
  if (/sala interativa/.test(n)) return 'Sala Interativa';
  if (/funcional/.test(n)) return 'Sala Interativa'; // contratos "Funcional" são da Sala Interativa
  return null;
}

export function detectTipo(desc: string): Tipo {
  const n = norm(desc);
  if (/plano mensal/.test(n)) return 'Mensal';
  if (/semestral/.test(n)) return 'Semestral';
  if (/trimestral/.test(n)) return 'Trimestral';
  if (/\banual\b/.test(n)) return 'Anual';
  return 'Outro';
}

export function methodLabel(m: string, plan: boolean): string {
  const n = norm(m);
  if (/pix/.test(n)) return plan ? 'PIX' : m || 'PIX/Depósito bancário';
  if (/cart/.test(n)) return plan ? 'Cartão de Crédito' : m || 'Cartão de crédito';
  return m || 'Não informado';
}

/* ---------- leitura ---------- */

/** Converte a matriz da planilha (1ª linha = cabeçalho) em linhas normalizadas. */
export function linhasDaPlanilha(matriz: unknown[][]): Linha[] {
  if (!matriz.length) return [];
  const header = matriz[0].map((h) => norm(h));
  const objs = matriz.slice(1).map((row) => {
    const o: Record<string, unknown> = {};
    header.forEach((h, i) => { if (h) o[h] = row[i]; });
    return o;
  });
  return normalizeRows(objs);
}

export function normalizeRows(objs: Record<string, unknown>[]): Linha[] {
  const out: Linha[] = [];
  objs.forEach((o) => {
    const g = (...names: string[]) => {
      for (const n of names) if (o[n] != null && o[n] !== '') return o[n];
      return null;
    };
    const cliente = g('cliente');
    if (!cliente) return;
    const desc = String(g('descricao') ?? '');
    const sit = norm(g('situacao') ?? '');
    const venc = toISO(g('data de vencimento'));
    if (!venc) return;
    out.push({
      cliente: String(cliente).trim(),
      desc,
      venc,
      rec: toISO(g('data de recebimento')),
      valor: toNum(g('valor')),
      recebido: toNum(g('valor recebido')),
      metodo: String(g('metodo de pagamento') ?? '').trim(),
      parcelas: String(g('numero de parcelas') ?? '').trim(),
      sit: sit.startsWith('receb') ? 'Recebido' : /cancel/.test(sit) ? 'Cancelado' : 'Aberto',
      consultor: String(g('consultor') ?? '').trim(),
      sede: detectSede(desc),
      tipo: detectTipo(desc),
    });
  });
  return out;
}

/** Junta várias exportações; a linha mais nova (arquivo posterior) vence. */
export function mergeRows(lists: Linha[][]): Linha[] {
  const map = new Map<string, Linha>();
  lists.forEach((l) => l.forEach((r) => map.set(`${norm(r.cliente)}|${norm(r.desc)}|${r.venc}|${r.parcelas}|${r.valor}`, r)));
  return Array.from(map.values());
}

/* ---------- contratos de planos ---------- */

export function deriveContracts(rows: Linha[]): Contrato[] {
  const groups = new Map<string, Contrato>();
  rows
    .filter((r) => r.sede && r.sit !== 'Cancelado' && r.tipo in PLAN_MESES)
    .forEach((r) => {
      const tipo = r.tipo as TipoPlano;
      const N = PLAN_MESES[tipo];
      const m = /^(\d+)\s*\/\s*(\d+)$/.exec(r.parcelas || '');
      const k = m ? +m[1] : 1;
      const start = addMonths(r.venc.slice(0, 7), -(k - 1));
      const key = `${r.sede}|${norm(r.cliente)}|${tipo}|${start}`;
      let g = groups.get(key);
      if (!g) {
        g = { key, cliente: r.cliente, sede: r.sede as Sede, tipo, start, N, venc: r.venc, mensal: 0, metodo: '', consultor: '', st: {} };
        groups.set(key, g);
      }
      if (r.venc < g.venc) g.venc = r.venc;
      g.st[r.venc.slice(0, 7)] = r.sit !== 'Recebido';
      g.mensal = m ? r.valor : r.valor / N >= MIN_MENSALIDADE ? r.valor / N : r.valor;
      if (r.metodo) g.metodo = r.metodo;
      if (r.consultor) g.consultor = r.consultor;
    });
  return Array.from(groups.values());
}

export function mergeContracts(saved: Contrato[], fresh: Contrato[]): Contrato[] {
  const map = new Map<string, Contrato>();
  saved.forEach((c) => map.set(c.key, c));
  fresh.forEach((c) => {
    const o = map.get(c.key);
    map.set(c.key, { ...o, ...c, st: { ...o?.st, ...c.st }, metodo: c.metodo || o?.metodo || '' });
  });
  return Array.from(map.values());
}

export function contratoManual(o: { cliente: string; sede: Sede; tipo: TipoPlano; start: string; mensal: number; metodo: string }): Contrato {
  return {
    key: `${o.sede}|${norm(o.cliente)}|${o.tipo}|${o.start}`,
    cliente: o.cliente.trim(), sede: o.sede, tipo: o.tipo, start: o.start, N: PLAN_MESES[o.tipo],
    venc: `${o.start}-01`, mensal: o.mensal, metodo: o.metodo, consultor: '', st: {}, manual: true,
  };
}

/* ---------- relatório ---------- */

const sum = <T,>(a: T[], f: (x: T) => number) => Math.round(a.reduce((s, r) => s + f(r), 0) * 100) / 100;
const byVenc = (a: Linha, b: Linha) => (a.venc < b.venc ? -1 : a.venc > b.venc ? 1 : a.cliente.localeCompare(b.cliente));
function groupSum<T>(items: T[], keyFn: (x: T) => string, valFn: (x: T) => number): [string, number][] {
  const m = new Map<string, number>();
  items.forEach((r) => m.set(keyFn(r), (m.get(keyFn(r)) ?? 0) + valFn(r)));
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
}

export function defaultCut(ref: string) {
  return { cutStart: `${ref}-10`, cutEnd: `${addMonths(ref, 1)}-10` };
}

export function buildReport(allRows: Linha[], cfg: Config, saved: Contrato[] = []): Relatorio {
  const { ref, cutStart, cutEnd } = cfg;
  const refStart = `${ref}-01`;
  const inSede = allRows.filter((r) => r.sede === cfg.sede && r.sit !== 'Cancelado');
  const isOpen = (r: Linha) => r.sit !== 'Recebido';

  const mens = inSede.filter((r) => r.tipo === 'Mensal' && r.venc.slice(0, 7) === ref).sort(byVenc);
  const mensRec = mens.filter((r) => !isOpen(r));
  const mensAb = mens.filter(isOpen);

  const prev = inSede.filter((r) => r.tipo === 'Mensal' && r.venc < refStart);
  const inad = prev.filter((r) => !isOpen(r) && r.rec && r.rec >= cutStart && r.rec <= cutEnd).sort(byVenc);
  const prevFora = prev.filter((r) => !isOpen(r) && r.rec && r.rec >= refStart && !(r.rec >= cutStart && r.rec <= cutEnd));
  const prevAberto = prev.filter(isOpen);

  const contratos = mergeContracts(saved, deriveContracts(allRows));
  const best = new Map<string, Contrato>();
  contratos.forEach((g) => {
    if (g.sede !== cfg.sede) return;
    if (!(g.start <= ref && ref <= addMonths(g.start, g.N - 1))) return;
    const k = `${norm(g.cliente)}|${g.tipo}`;
    const cur = best.get(k);
    if (!cur || g.start > cur.start) best.set(k, g);
  });
  const planos: PlanoAtivo[] = Array.from(best.values())
    .map((g) => ({
      key: g.key, tipo: g.tipo, cliente: g.cliente, venc: g.venc, de: g.start, ate: addMonths(g.start, g.N - 1),
      valor: Math.round(g.mensal * 100) / 100, metodo: g.metodo,
      aberto: g.st[ref] !== undefined ? g.st[ref] : g.st[g.start] !== undefined ? g.st[g.start] : false,
      manual: !!g.manual,
    }))
    .sort((a, b) => (a.venc < b.venc ? 1 : a.venc > b.venc ? -1 : a.cliente.localeCompare(b.cliente)));
  const plRec = planos.filter((p) => !p.aberto);
  const plAb = planos.filter((p) => p.aberto);

  const ativos = new Set<string>();
  const inadSet = new Set<string>();
  mens.forEach((r) => { ativos.add(norm(r.cliente)); if (isOpen(r)) inadSet.add(norm(r.cliente)); });
  planos.forEach((p) => { ativos.add(norm(p.cliente)); if (p.aberto) inadSet.add(norm(p.cliente)); });

  const tMens = sum(mensRec, (r) => r.recebido);
  const tPl = sum(plRec, (p) => p.valor);
  const tInad = sum(inad, (r) => r.recebido);
  const tAb = Math.round((sum(mensAb, (r) => r.valor) + sum(plAb, (p) => p.valor)) * 100) / 100;
  const semSede = allRows.filter((r) => !r.sede);

  return {
    cfg,
    mensais: { rows: mens, recebido: tMens, porMetodo: groupSum(mensRec, (r) => methodLabel(r.metodo, false), (r) => r.recebido), aberto: sum(mensAb, (r) => r.valor), nAberto: mensAb.length },
    inad: { rows: inad, total: tInad },
    planos: {
      rows: planos, recebido: tPl, porMetodo: groupSum(plRec, (p) => methodLabel(p.metodo, true), (p) => p.valor),
      nTri: planos.filter((p) => p.tipo === 'Trimestral').length, nSem: planos.filter((p) => p.tipo === 'Semestral').length, nAnu: planos.filter((p) => p.tipo === 'Anual').length,
    },
    alunos: { ativos: ativos.size, inad: inadSet.size, adimp: ativos.size - inadSet.size },
    totais: { aberto: tAb, distribuicao: Math.round((tMens + tPl + tInad) * 100) / 100, geral: Math.round((tMens + tPl + tInad + tAb) * 100) / 100 },
    diag: {
      linhas: allRows.length,
      porSede: SEDES.map((s) => [s, allRows.filter((r) => r.sede === s).length] as [Sede, number]),
      semSede: semSede.length,
      semSedeValor: sum(semSede, (r) => r.recebido),
      semSedeLista: groupSum(semSede, (r) => r.desc || '(sem descrição)', () => 1),
      prevFora: { n: prevFora.length, total: sum(prevFora, (r) => r.recebido) },
      prevAberto: { n: prevAberto.length, total: sum(prevAberto, (r) => r.valor) },
    },
  };
}
