-- Remover as políticas RLS existentes que requerem autenticação
DROP POLICY IF EXISTS "Authenticated users can view subscription plans" ON subscription_plans;
DROP POLICY IF EXISTS "Authenticated users can insert subscription plans" ON subscription_plans;  
DROP POLICY IF EXISTS "Authenticated users can update subscription plans" ON subscription_plans;
DROP POLICY IF EXISTS "Authenticated users can delete subscription plans" ON subscription_plans;

-- Criar novas políticas RLS que permitem acesso público
CREATE POLICY "Allow public read access to subscription plans" 
ON subscription_plans 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert access to subscription plans" 
ON subscription_plans 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update access to subscription plans" 
ON subscription_plans 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete access to subscription plans" 
ON subscription_plans 
FOR DELETE 
USING (true);