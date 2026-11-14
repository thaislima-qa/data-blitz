import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileUp, ImageDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtMonth } from "@/lib/consolidado";
import { comparar, gerarImagemComparacao, lerMetaPDF, type Comparacao, type MetaPDF } from "@/lib/comparar";
import logoHorizontal from "@/assets/taiana-lima-academy-horizontal.png?inline";

function Slot({ titulo, meta, onFile }: { titulo: string; meta: MetaPDF | null; onFile: (f: File) => void }) {
  return (
    <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center cursor-pointer hover:bg-accent/30">
      <FileUp className="h-8 w-8 text-muted-foreground" />
      <span className="font-semibold">{titulo}</span>
      {meta ? <span className="text-sm text-green-700">{meta.sede} · {fmtMonth(meta.ref)} · {meta.ativos} alunos ativos</span>
            : <span className="text-sm text-muted-foreground">Clique para escolher o PDF do consolidado</span>}
      <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
    </label>
  );
}

export default function Comparar() {
  const navigate = useNavigate();
  const [a, setA] = useState<MetaPDF | null>(null);
  const [b, setB] = useState<MetaPDF | null>(null);
  const [comp, setComp] = useState<Comparacao | null>(null);
  const [img, setImg] = useState<{ url: string; nome: string } | null>(null);

  const ler = (set: (m: MetaPDF) => void) => async (f: File) => {
    try { set(await lerMetaPDF(f)); setComp(null); setImg(null); }
    catch (e: any) { toast.error(e?.message ?? "Erro ao ler o PDF"); }
  };

  const gerar = async () => {
    if (!a || !b) return;
    if (a.sede !== b.sede) toast.warning(`Atenção: os PDFs são de sedes diferentes (${a.sede} e ${b.sede}).`);
    if (a.ref === b.ref) { toast.error("Os dois PDFs são do mesmo mês."); return; }
    try {
      const c = comparar(a, b);
      const blob = await gerarImagemComparacao(c, logoHorizontal);
      setComp(c);
      setImg((old) => { if (old) URL.revokeObjectURL(old.url); return { url: URL.createObjectURL(blob), nome: `Entradas-Saidas-${c.atual.sede.replace(/\s+/g, "-")}-${c.anterior.ref}-a-${c.atual.ref}.png` }; });
    } catch (e: any) { toast.error(e?.message ?? "Não foi possível gerar a imagem"); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}><ArrowLeft className="h-4 w-4 mr-1" />Consolidado</Button>
          <h1 className="text-3xl font-bold">Entradas e Saídas</h1>
        </div>
        <p className="text-muted-foreground">Envie o PDF do consolidado do mês anterior e o do mês atual (gerados por este sistema). A ordem não importa: o sistema identifica pelo mês.</p>

        <div className="grid gap-4 md:grid-cols-2">
          <Slot titulo="PDF do mês anterior" meta={a} onFile={ler(setA)} />
          <Slot titulo="PDF do mês atual" meta={b} onFile={ler(setB)} />
        </div>
        <Button disabled={!a || !b} onClick={gerar}><ImageDown className="h-4 w-4 mr-2" />Gerar imagem</Button>

        {comp && img && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{comp.entradas.length} entrada(s) e {comp.saidas.length} saída(s)</CardTitle>
              <div className="flex gap-2 pt-2">
                <Button asChild size="sm"><a href={img.url} download={img.nome}>Salvar imagem</a></Button>
                <Button asChild size="sm" variant="outline"><a href={img.url} target="_blank" rel="noopener noreferrer">Abrir em nova aba</a></Button>
              </div>
            </CardHeader>
            <CardContent><img src={img.url} alt="Entradas e saídas de alunos" className="w-full rounded border" /></CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
