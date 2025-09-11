-- Remove overly permissive RLS policies that allow public access to sensitive customer data
DROP POLICY IF EXISTS "Anyone can delete subscription plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Anyone can insert subscription plans" ON public.subscription_plans;  
DROP POLICY IF EXISTS "Anyone can update subscription plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Subscription plans are viewable by everyone" ON public.subscription_plans;

-- Create secure RLS policies that require authentication
-- Only authenticated users can view subscription plans
CREATE POLICY "Authenticated users can view subscription plans" 
ON public.subscription_plans 
FOR SELECT 
TO authenticated 
USING (true);

-- Only authenticated users can insert subscription plans  
CREATE POLICY "Authenticated users can insert subscription plans"
ON public.subscription_plans
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Only authenticated users can update subscription plans
CREATE POLICY "Authenticated users can update subscription plans"
ON public.subscription_plans
FOR UPDATE 
TO authenticated
USING (true);

-- Only authenticated users can delete subscription plans
CREATE POLICY "Authenticated users can delete subscription plans"
ON public.subscription_plans
FOR DELETE
TO authenticated  
USING (true);