
-- ============================================
-- PHASE 1: CAM Charges, Owner Statements, Report Builder
-- ============================================

-- === CAM Budgets ===
CREATE TABLE public.cam_budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  budget_year INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT 'Annual CAM Budget',
  total_budget NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, active, reconciled
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(property_id, budget_year)
);

ALTER TABLE public.cam_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own CAM budgets" ON public.cam_budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own CAM budgets" ON public.cam_budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own CAM budgets" ON public.cam_budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own CAM budgets" ON public.cam_budgets FOR DELETE USING (auth.uid() = user_id);

-- === CAM Line Items (budget categories) ===
CREATE TABLE public.cam_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES public.cam_budgets(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- insurance, taxes, maintenance, utilities, management, landscaping, snow_removal, security, reserves, other
  description TEXT,
  budgeted_amount NUMERIC NOT NULL DEFAULT 0,
  actual_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cam_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view CAM line items" ON public.cam_line_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM cam_budgets WHERE cam_budgets.id = cam_line_items.budget_id AND cam_budgets.user_id = auth.uid()));
CREATE POLICY "Users can insert CAM line items" ON public.cam_line_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM cam_budgets WHERE cam_budgets.id = cam_line_items.budget_id AND cam_budgets.user_id = auth.uid()));
CREATE POLICY "Users can update CAM line items" ON public.cam_line_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM cam_budgets WHERE cam_budgets.id = cam_line_items.budget_id AND cam_budgets.user_id = auth.uid()));
CREATE POLICY "Users can delete CAM line items" ON public.cam_line_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM cam_budgets WHERE cam_budgets.id = cam_line_items.budget_id AND cam_budgets.user_id = auth.uid()));

-- === CAM Tenant Allocations ===
CREATE TABLE public.cam_tenant_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES public.cam_budgets(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  allocation_method TEXT NOT NULL DEFAULT 'pro_rata_sqft', -- pro_rata_sqft, fixed_amount, percentage
  allocation_percentage NUMERIC, -- used for percentage method
  fixed_amount NUMERIC, -- used for fixed_amount method
  tenant_sqft NUMERIC, -- tenant's square footage for pro-rata
  estimated_annual NUMERIC NOT NULL DEFAULT 0,
  actual_annual NUMERIC NOT NULL DEFAULT 0,
  monthly_charge NUMERIC NOT NULL DEFAULT 0,
  reconciliation_amount NUMERIC DEFAULT 0, -- positive = tenant owes, negative = credit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(budget_id, tenant_id)
);

ALTER TABLE public.cam_tenant_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view CAM allocations" ON public.cam_tenant_allocations FOR SELECT
  USING (EXISTS (SELECT 1 FROM cam_budgets WHERE cam_budgets.id = cam_tenant_allocations.budget_id AND cam_budgets.user_id = auth.uid()));
CREATE POLICY "Users can insert CAM allocations" ON public.cam_tenant_allocations FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM cam_budgets WHERE cam_budgets.id = cam_tenant_allocations.budget_id AND cam_budgets.user_id = auth.uid()));
CREATE POLICY "Users can update CAM allocations" ON public.cam_tenant_allocations FOR UPDATE
  USING (EXISTS (SELECT 1 FROM cam_budgets WHERE cam_budgets.id = cam_tenant_allocations.budget_id AND cam_budgets.user_id = auth.uid()));
CREATE POLICY "Users can delete CAM allocations" ON public.cam_tenant_allocations FOR DELETE
  USING (EXISTS (SELECT 1 FROM cam_budgets WHERE cam_budgets.id = cam_tenant_allocations.budget_id AND cam_budgets.user_id = auth.uid()));

-- === Financial Transactions (Owner Statements) ===
CREATE TABLE public.financial_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL, -- income, expense
  category TEXT NOT NULL, -- rent, cam_recovery, work_order, tax, insurance, utility, management_fee, maintenance, other
  description TEXT,
  amount NUMERIC NOT NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_number TEXT, -- check #, invoice #, etc.
  reference_entity_type TEXT, -- work_order, property_tax, cam_charge, etc.
  reference_entity_id UUID,
  payment_method TEXT, -- check, zelle, ach, wire, cash, other
  status TEXT NOT NULL DEFAULT 'recorded', -- recorded, pending, cleared, void
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions" ON public.financial_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own transactions" ON public.financial_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own transactions" ON public.financial_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own transactions" ON public.financial_transactions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_financial_transactions_property ON public.financial_transactions(property_id);
CREATE INDEX idx_financial_transactions_date ON public.financial_transactions(transaction_date);
CREATE INDEX idx_financial_transactions_category ON public.financial_transactions(category);

-- === Report Templates (Report Builder) ===
CREATE TABLE public.report_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL DEFAULT 'custom', -- financial, compliance, violations, custom
  data_sources JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of source configs
  filters JSONB DEFAULT '{}'::jsonb, -- date range, property, portfolio filters
  columns JSONB DEFAULT '[]'::jsonb, -- selected columns/fields
  sort_config JSONB DEFAULT '{}'::jsonb,
  group_by TEXT,
  include_charts BOOLEAN DEFAULT false,
  schedule_frequency TEXT, -- null, daily, weekly, monthly
  schedule_recipients JSONB DEFAULT '[]'::jsonb,
  is_template BOOLEAN DEFAULT false, -- true = shared template
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own report templates" ON public.report_templates FOR SELECT USING (auth.uid() = user_id OR is_template = true);
CREATE POLICY "Users can insert their own report templates" ON public.report_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own report templates" ON public.report_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own report templates" ON public.report_templates FOR DELETE USING (auth.uid() = user_id);

-- === Report Runs (generated instances) ===
CREATE TABLE public.report_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES public.report_templates(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'custom',
  parameters JSONB DEFAULT '{}'::jsonb, -- runtime parameters (date range, filters)
  result_data JSONB, -- generated report data
  row_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'generating', -- generating, completed, failed
  pdf_url TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.report_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own report runs" ON public.report_runs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own report runs" ON public.report_runs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own report runs" ON public.report_runs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own report runs" ON public.report_runs FOR DELETE USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_cam_budgets_updated_at BEFORE UPDATE ON public.cam_budgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cam_line_items_updated_at BEFORE UPDATE ON public.cam_line_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cam_tenant_allocations_updated_at BEFORE UPDATE ON public.cam_tenant_allocations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_financial_transactions_updated_at BEFORE UPDATE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_report_templates_updated_at BEFORE UPDATE ON public.report_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
