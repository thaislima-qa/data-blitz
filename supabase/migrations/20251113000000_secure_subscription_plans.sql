-- Fecha o acesso público à tabela subscription_plans (nome de cliente e valores).
-- Só entra quem estiver logado E tiver o e-mail cadastrado em allowed_users.
-- A lista de e-mails é preenchida pelo painel do Supabase, nunca por este repositório.

-- 1) Lista de e-mails autorizados
CREATE TABLE IF NOT EXISTS public.allowed_users (
  email TEXT PRIMARY KEY
);
ALTER TABLE public.allowed_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.allowed_users FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_allowed_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.allowed_users
    WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
REVOKE ALL ON FUNCTION public.is_allowed_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_allowed_user() TO authenticated;

-- 2) Colunas que o código já usa e que não estavam nas migrations anteriores
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS sede TEXT;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS "metodoPagamento" TEXT;

-- 3) Remove todas as políticas abertas ou antigas
DROP POLICY IF EXISTS "Allow public read access to subscription plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Allow public insert access to subscription plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Allow public update access to subscription plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Allow public delete access to subscription plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Authenticated users can view subscription plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Authenticated users can insert subscription plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Authenticated users can update subscription plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Authenticated users can delete subscription plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Subscription plans are viewable by everyone" ON public.subscription_plans;
DROP POLICY IF EXISTS "Anyone can insert subscription plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Anyone can update subscription plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Anyone can delete subscription plans" ON public.subscription_plans;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscription_plans FROM anon;

-- 4) Novas políticas: apenas usuário autorizado
CREATE POLICY "Allowed users can read subscription plans"
  ON public.subscription_plans FOR SELECT TO authenticated
  USING (public.is_allowed_user());

CREATE POLICY "Allowed users can insert subscription plans"
  ON public.subscription_plans FOR INSERT TO authenticated
  WITH CHECK (public.is_allowed_user());

CREATE POLICY "Allowed users can update subscription plans"
  ON public.subscription_plans FOR UPDATE TO authenticated
  USING (public.is_allowed_user())
  WITH CHECK (public.is_allowed_user());

CREATE POLICY "Allowed users can delete subscription plans"
  ON public.subscription_plans FOR DELETE TO authenticated
  USING (public.is_allowed_user());
