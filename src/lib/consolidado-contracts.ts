import { supabase } from "@/integrations/supabase/client";
import type { Contrato } from "@/lib/consolidado";

// A tabela plan_contracts ainda não está nos tipos gerados do Supabase.
const table = () => (supabase as any).from("plan_contracts");

const fromRow = (r: any): Contrato => ({
  key: r.key,
  cliente: r.cliente,
  sede: r.sede,
  tipo: r.tipo,
  start: r.inicio,
  N: r.meses,
  venc: r.vencimento,
  mensal: Number(r.valor_mensal),
  metodo: r.metodo ?? "",
  consultor: r.consultor ?? "",
  st: r.status ?? {},
  manual: !!r.manual,
});

const toRow = (c: Contrato) => ({
  key: c.key,
  cliente: c.cliente,
  sede: c.sede,
  tipo: c.tipo,
  inicio: c.start,
  meses: c.N,
  vencimento: c.venc,
  valor_mensal: c.mensal,
  metodo: c.metodo,
  consultor: c.consultor,
  status: c.st,
  manual: !!c.manual,
});

export async function carregarContratos(): Promise<Contrato[]> {
  const { data, error } = await table().select("*").order("inicio", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function salvarContratos(contratos: Contrato[]): Promise<void> {
  if (!contratos.length) return;
  const { error } = await table().upsert(contratos.map(toRow), { onConflict: "key" });
  if (error) throw error;
}

export async function removerContrato(key: string): Promise<void> {
  const { error } = await table().delete().eq("key", key);
  if (error) throw error;
}
