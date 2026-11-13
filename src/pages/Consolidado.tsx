import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { readSheet } from "read-excel-file/browser";
import { ArrowLeft, FileDown, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import logoPathCover from "@/assets/CT Taiana Lima.png";
import logoPathHeader from "@/assets/mini-logo.png";
import {
  SEDES, addMonths, buildReport, contratoManual, defaultCut, deriveContracts, fmtDate, fmtMonth, fmtMoney,
  linhasDaPlanilha, mergeContracts, mergeRows, methodLabel,
  type Contrato, type Linha, type Sede, type TipoPlano,
} from "@/lib/consolidado";
import { carregarContratos, removerContrato, salvarContratos } from "@/lib/consolidado-contracts";
import { gerarConsolidadoPDF } from "@/lib/consolidado-pdf";

const shortDesc = (d: string) => d.replace(/\s*\[Moove [^\]]*\]/gi, "").trim() || d;
const hoje = () => new Date().toISOString().slice(0, 10);

interface Arquivo { name: string; rows: Linha[] }

export default function Consolidado() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [sede, setSede] = useState<Sede>("Maraponga");
  const [ref, setRef] = useState("");
  const [cutStart, setCutStart] = useState("");
  const [cutEnd, setCutEnd] = useState("");
  const [cutTouched, setCutTouched] = useState(false);
  const [studio, setStudio] = useState("CT Taiana Lima");
  const [busy, setBusy] = useState(false);
  const [novo, setNovo] = useState({ cliente: "", sede: "Maraponga" as Sede, tipo: "Trimestral" as TipoPlano, start: "", mensal: "", metodo: "PIX/Depósito bancário" });

  const rows = useMemo(() => mergeRows(arquivos.map((a) => a.rows)), [arquivos]);

  useEffect(() => {
    carregarContratos().then(setContratos).catch(() => toast.error("Não consegui carregar os contratos de planos."));
  }, []);

  const aplicarCorte = useCallback((mes: string) => {
    const c = defaultCut(mes);
    setCutStart(c.cutStart);
    setCutEnd(c.cutEnd);
  }, []);

  const escolherMes = (mes: string) => {
    setRef(mes);
    if (!cutTouched && mes) aplicarCorte(mes);
  };

  const lerArquivos = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const lidos: Arquivo[] = [];
      for (const f of Array.from(files)) {
        const linhas = linhasDaPlanilha((await readSheet(f)) as unknown[][]);
        if (!linhas.length) throw new Error(`Não encontrei as colunas Cliente e Data de vencimento em ${f.name}`);
        lidos.push({ name: f.name, rows: linhas });
      }
      const todas = mergeRows(lidos.map((a) => a.rows));
      const novos = deriveContracts(todas);
      const mesclados = mergeContracts(contratos, novos);
      const chaves = new Set(novos.map((c) => c.key));
      await salvarContratos(mesclados.filter((c) => chaves.has(c.key)));
      setContratos(mesclados);
      setArquivos(lidos);

      const contagem: Record<string, number> = {};
      todas.forEach((r) => { if (r.sede) contagem[r.sede] = (contagem[r.sede] ?? 0) + 1; });
      const sedePadrao = [...SEDES].sort((a, b) => (contagem[b] ?? 0) - (contagem[a] ?? 0))[0];
      setSede(sedePadrao);
      const meses = Array.from(new Set(todas.filter((r) => r.sede === sedePadrao && r.tipo === "Mensal").map((r) => r.venc.slice(0, 7)))).sort();
      const anterior = addMonths(hoje().slice(0, 7), -1);
      const mes = meses.includes(anterior) ? anterior : meses[meses.length - 1] ?? anterior;
      setRef(mes);
      setCutTouched(false);
      aplicarCorte(mes);
      toast.success(`${todas.length} linhas lidas. ${novos.length} contrato(s) de plano guardado(s).`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao ler a planilha");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const rel = useMemo(
    () => (ref && rows.length ? buildReport(rows, { sede, ref, cutStart, cutEnd }, contratos) : null),
    [rows, sede, ref, cutStart, cutEnd, contratos],
  );

  const baixarPDF = async () => {
    if (!rel) return;
    try {
      await gerarConsolidadoPDF(rel, studio || "CT Taiana Lima", logoPathCover, logoPathHeader);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar o PDF");
    }
  };

  const adicionarContrato = async () => {
    const mensal = parseFloat(novo.mensal.replace(",", "."));
    if (!novo.cliente.trim() || !novo.start || !(mensal > 0)) {
      toast.error("Preencha cliente, mês de início e valor mensal.");
      return;
    }
    const c = contratoManual({ cliente: novo.cliente, sede: novo.sede, tipo: novo.tipo, start: novo.start, mensal, metodo: novo.metodo });
    try {
      await salvarContratos([c]);
      setContratos((prev) => mergeContracts(prev, [c]));
      setNovo((n) => ({ ...n, cliente: "", mensal: "" }));
      toast.success("Contrato adicionado.");
    } catch {
      toast.error("Não foi possível salvar o contrato.");
    }
  };

  const remover = async (c: Contrato) => {
    if (!window.confirm(`Remover o contrato de ${c.cliente} (${c.tipo}, ${fmtMonth(c.start)})?`)) return;
    try {
      await removerContrato(c.key);
      setContratos((prev) => prev.filter((x) => x.key !== c.key));
    } catch {
      toast.error("Não foi possível remover o contrato.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button>
          <h1 className="text-3xl font-bold">Consolidado Mensal</h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader><CardTitle className="text-base">Planilha e filtros</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Contas a receber (.xlsx)</Label>
                <input ref={fileRef} type="file" accept=".xlsx" multiple hidden onChange={(e) => lerArquivos(e.target.files)} />
                <Button variant="outline" className="w-full" disabled={busy} onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />{busy ? "Lendo…" : "Escolher planilha(s)"}
                </Button>
                {arquivos.map((a) => (
                  <p key={a.name} className="text-xs text-muted-foreground flex justify-between gap-2"><span className="break-all">{a.name}</span><span>{a.rows.length} linhas</span></p>
                ))}
              </div>
              <div className="space-y-2">
                <Label>Sede (pelo contrato)</Label>
                <Select value={sede} onValueChange={(v) => setSede(v as Sede)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SEDES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ref">Mês de referência</Label>
                <Input id="ref" type="month" value={ref} onChange={(e) => escolherMes(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Período de corte dos recebimentos atrasados</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" aria-label="Início do corte" value={cutStart} onChange={(e) => { setCutTouched(true); setCutStart(e.target.value); }} />
                  <Input type="date" aria-label="Fim do corte" value={cutEnd} onChange={(e) => { setCutTouched(true); setCutEnd(e.target.value); }} />
                </div>
                <p className="text-xs text-muted-foreground">Só entram mensalidades de meses anteriores recebidas neste período.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="studio">Nome na capa</Label>
                <Input id="studio" value={studio} onChange={(e) => setStudio(e.target.value)} />
              </div>
              <Button className="w-full" disabled={!rel} onClick={baixarPDF}><FileDown className="h-4 w-4 mr-2" />Baixar PDF</Button>
            </CardContent>
          </Card>

          <div className="space-y-6 min-w-0">
            {!rel ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Envie a planilha de contas a receber para gerar o consolidado.</CardContent></Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Prestação de Contas · {rel.cfg.sede} · {fmtMonth(rel.cfg.ref)}</CardTitle>
                    <p className="text-sm text-muted-foreground">Recebimentos atrasados de {fmtDate(rel.cfg.cutStart)} a {fmtDate(rel.cfg.cutEnd)}</p>
                  </CardHeader>
                  <CardContent className="space-y-4 max-w-xl">
                    <Bloco titulo="Planos Mensais · total recebido" valor={rel.mensais.recebido} cor="pos" itens={rel.mensais.porMetodo} />
                    <Bloco titulo="Planos Ativos · total recebido" valor={rel.planos.recebido} cor="pos" itens={rel.planos.porMetodo} />
                    <Bloco titulo="Inadimplentes recebimentos" valor={rel.inad.total} cor="pos" />
                    <Bloco titulo="Valor em aberto" valor={rel.totais.aberto} cor="neg" />
                    <div className="flex justify-between text-2xl font-bold text-primary border-t pt-3"><span>Total Geral</span><span>{fmtMoney(rel.totais.geral)}</span></div>
                    <div className="flex justify-between italic"><span>Total Distribuição*</span><span>{fmtMoney(rel.totais.distribuicao)}</span></div>
                    <p className="text-xs text-muted-foreground">*Valor antes da dedução dos impostos</p>
                    <div className="flex gap-6 pt-2">
                      <Stat n={rel.alunos.ativos} l="alunos ativos" /><Stat n={rel.alunos.adimp} l="adimplentes" /><Stat n={rel.alunos.inad} l="inadimplentes" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Planos de Assinatura Ativos no Período</CardTitle>
                    <p className="text-sm text-muted-foreground">Total de planos: {rel.planos.rows.length} · Trimestral: {rel.planos.nTri} | Semestral: {rel.planos.nSem}</p>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Cliente</TableHead><TableHead>Vencimento</TableHead><TableHead>Período</TableHead><TableHead className="text-right">Valor mensal</TableHead><TableHead>Método</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {rel.planos.rows.map((p) => (
                          <TableRow key={p.key}>
                            <TableCell>{p.tipo}</TableCell><TableCell>{p.cliente}</TableCell><TableCell>{fmtDate(p.venc)}</TableCell>
                            <TableCell className="whitespace-nowrap">{fmtMonth(p.de)} a {fmtMonth(p.ate)}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">{fmtMoney(p.valor)}</TableCell>
                            <TableCell>{methodLabel(p.metodo, true)} {p.aberto && <Badge variant="destructive">Aberto</Badge>}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <TabelaLinhas titulo="Inadimplentes Recebidos" sub={`Mensalidades de meses anteriores recebidas entre ${fmtDate(rel.cfg.cutStart)} e ${fmtDate(rel.cfg.cutEnd)}.`} linhas={rel.inad.rows} />
                <TabelaLinhas titulo="Planos Mensais Ativos no Período" sub={`${rel.mensais.rows.length} mensalidades com vencimento em ${fmtMonth(rel.cfg.ref)}, incluindo as pagas depois do fim do mês.`} linhas={rel.mensais.rows} />

                <Card>
                  <CardHeader><CardTitle className="text-base">Conferência dos dados</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>{rel.diag.linhas} linhas lidas · {rel.diag.porSede.map(([s, n]) => `${s}: ${n}`).join(" · ")}</p>
                    <p>{rel.diag.semSede} linhas sem sede no contrato ficaram de fora ({fmtMoney(rel.diag.semSedeValor)} recebidos){rel.diag.semSedeLista.length ? `: ${rel.diag.semSedeLista.slice(0, 6).map(([d, n]) => `${d} (${n})`).join(", ")}` : ""}.</p>
                    <p>Recebidos de meses anteriores fora do período de corte, não somados: {rel.diag.prevFora.n} ({fmtMoney(rel.diag.prevFora.total)}).</p>
                    <p>Mensalidades de meses anteriores ainda em aberto, não entram no relatório: {rel.diag.prevAberto.n} ({fmtMoney(rel.diag.prevAberto.total)}).</p>
                  </CardContent>
                </Card>
              </>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contratos de planos guardados ({contratos.length})</CardTitle>
                <p className="text-sm text-muted-foreground">Gravados no Supabase a cada planilha enviada e usados nos meses seguintes. Adicione à mão os planos que começaram antes de usar o sistema.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {contratos.length > 0 && (
                  <Table>
                    <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Sede</TableHead><TableHead>Plano</TableHead><TableHead>Vigência</TableHead><TableHead className="text-right">Valor mensal</TableHead><TableHead /></TableRow></TableHeader>
                    <TableBody>
                      {contratos.map((c) => (
                        <TableRow key={c.key}>
                          <TableCell>{c.cliente} {c.manual && <Badge variant="secondary">manual</Badge>}</TableCell>
                          <TableCell>{c.sede}</TableCell><TableCell>{c.tipo}</TableCell>
                          <TableCell className="whitespace-nowrap">{fmtMonth(c.start)} a {fmtMonth(addMonths(c.start, c.N - 1))}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">{fmtMoney(c.mensal)}</TableCell>
                          <TableCell><Button variant="ghost" size="icon" aria-label={`Remover ${c.cliente}`} onClick={() => remover(c)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1"><Label htmlFor="c-nome">Cliente</Label><Input id="c-nome" value={novo.cliente} onChange={(e) => setNovo({ ...novo, cliente: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Sede</Label>
                    <Select value={novo.sede} onValueChange={(v) => setNovo({ ...novo, sede: v as Sede })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SEDES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1"><Label>Plano</Label>
                    <Select value={novo.tipo} onValueChange={(v) => setNovo({ ...novo, tipo: v as TipoPlano })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Trimestral">Trimestral</SelectItem><SelectItem value="Semestral">Semestral</SelectItem></SelectContent></Select></div>
                  <div className="space-y-1"><Label htmlFor="c-inicio">Mês de início</Label><Input id="c-inicio" type="month" value={novo.start} onChange={(e) => setNovo({ ...novo, start: e.target.value })} /></div>
                  <div className="space-y-1"><Label htmlFor="c-valor">Valor mensal (R$)</Label><Input id="c-valor" inputMode="decimal" value={novo.mensal} onChange={(e) => setNovo({ ...novo, mensal: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Método</Label>
                    <Select value={novo.metodo} onValueChange={(v) => setNovo({ ...novo, metodo: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PIX/Depósito bancário">PIX</SelectItem><SelectItem value="Cartão de crédito">Cartão de crédito</SelectItem></SelectContent></Select></div>
                </div>
                <Button variant="outline" onClick={adicionarContrato}>Adicionar contrato</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bloco({ titulo, valor, cor, itens }: { titulo: string; valor: number; cor: "pos" | "neg"; itens?: [string, number][] }) {
  return (
    <div className="border-b pb-3">
      <div className={`flex justify-between font-semibold ${cor === "pos" ? "text-green-700 dark:text-green-400" : "text-destructive"}`}><span>{titulo}</span><span>{fmtMoney(valor)}</span></div>
      {itens?.map(([m, v]) => <div key={m} className="flex justify-between text-sm text-muted-foreground pl-3"><span>{m}</span><span>{fmtMoney(v)}</span></div>)}
    </div>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return <div><div className="text-2xl font-bold">{n}</div><div className="text-xs text-muted-foreground">{l}</div></div>;
}

function TabelaLinhas({ titulo, sub, linhas }: { titulo: string; sub: string; linhas: Linha[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{titulo}</CardTitle><p className="text-sm text-muted-foreground">{sub}</p></CardHeader>
      <CardContent>
        {linhas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum registro neste filtro.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Descrição</TableHead><TableHead>Vencimento</TableHead><TableHead>Recebimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Recebido</TableHead><TableHead>Método</TableHead><TableHead>Situação</TableHead></TableRow></TableHeader>
            <TableBody>
              {linhas.map((x, i) => (
                <TableRow key={i}>
                  <TableCell>{x.cliente}</TableCell><TableCell>{shortDesc(x.desc)}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmtDate(x.venc)}</TableCell><TableCell className="whitespace-nowrap">{fmtDate(x.rec)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{fmtMoney(x.valor)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{x.sit === "Recebido" ? fmtMoney(x.recebido) : ""}</TableCell>
                  <TableCell>{x.metodo}</TableCell>
                  <TableCell>{x.sit === "Recebido" ? <Badge variant="secondary">Recebido</Badge> : <Badge variant="destructive">Aberto</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
