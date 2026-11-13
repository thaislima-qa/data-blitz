-- Contratos de planos trimestrais/semestrais para o Consolidado Mensal.
-- Um registro por contrato (cliente + sede + tipo + mês de início). O app grava a cada planilha
-- enviada e usa nos meses seguintes, porque o plano só aparece na planilha do mês em que começa.
-- Requer a migration 20251113000000 (função public.is_allowed_user).

CREATE TABLE IF NOT EXISTS public.plan_contracts (
  key TEXT PRIMARY KEY,
  cliente TEXT NOT NULL,
  sede TEXT NOT NULL CHECK (sede IN ('Maraponga', 'Fátima', 'Sala Interativa')),
  tipo TEXT NOT NULL CHECK (tipo IN ('Trimestral', 'Semestral', 'Anual')),
  inicio TEXT NOT NULL,            -- AAAA-MM do primeiro mês de vigência
  meses INTEGER NOT NULL CHECK (meses > 0),
  vencimento DATE NOT NULL,        -- vencimento da primeira cobrança
  valor_mensal NUMERIC(10,2) NOT NULL,
  metodo TEXT NOT NULL DEFAULT '',
  consultor TEXT NOT NULL DEFAULT '',
  status JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {"AAAA-MM": true} = parcela do mês em aberto
  manual BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_contracts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plan_contracts FROM anon;

CREATE POLICY "Allowed users can read plan contracts"
  ON public.plan_contracts FOR SELECT TO authenticated
  USING (public.is_allowed_user());
CREATE POLICY "Allowed users can insert plan contracts"
  ON public.plan_contracts FOR INSERT TO authenticated
  WITH CHECK (public.is_allowed_user());
CREATE POLICY "Allowed users can update plan contracts"
  ON public.plan_contracts FOR UPDATE TO authenticated
  USING (public.is_allowed_user()) WITH CHECK (public.is_allowed_user());
CREATE POLICY "Allowed users can delete plan contracts"
  ON public.plan_contracts FOR DELETE TO authenticated
  USING (public.is_allowed_user());

CREATE TRIGGER update_plan_contracts_updated_at
BEFORE UPDATE ON public.plan_contracts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
