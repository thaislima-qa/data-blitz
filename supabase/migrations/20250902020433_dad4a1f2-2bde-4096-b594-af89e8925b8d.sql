-- Create table for subscription plans
CREATE TABLE public.subscription_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_plano TEXT NOT NULL CHECK (tipo_plano IN ('trimestral', 'semestral')),
  data_vencimento DATE NOT NULL,
  data_inicio TEXT NOT NULL, -- formato mm/aaaa
  data_fim TEXT NOT NULL, -- formato mm/aaaa
  valor DECIMAL(10,2),
  nome_cliente TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Create policy for public access (since this is a reporting system)
CREATE POLICY "Subscription plans are viewable by everyone" 
ON public.subscription_plans 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert subscription plans" 
ON public.subscription_plans 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update subscription plans" 
ON public.subscription_plans 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete subscription plans" 
ON public.subscription_plans 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();