-- ============================================================
-- SCHEMA DO SUPABASE — Fit Planner
-- Execute este SQL no SQL Editor do Supabase Dashboard
-- ============================================================

-- Tabela de receitas
CREATE TABLE IF NOT EXISTS public.recipes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  category     text NOT NULL CHECK (category IN (
                 'breakfast','morningSnack','lunch',
                 'afternoonSnack','dinner','detoxJuice'
               )),
  calories     int NOT NULL DEFAULT 0,
  protein      int NOT NULL DEFAULT 0,
  carbs        int NOT NULL DEFAULT 0,
  fat          int NOT NULL DEFAULT 0,
  ingredients  jsonb NOT NULL DEFAULT '[]'::jsonb,
  prep         text,
  emoji        text DEFAULT '🥗',
  benefits     text,
  pdf_source   text,
  created_at   timestamptz DEFAULT now()
);

-- Tabela de PDFs importados
CREATE TABLE IF NOT EXISTS public.pdf_uploads (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename       text NOT NULL,
  pdf_type       text NOT NULL CHECK (pdf_type IN ('fit', 'detox')),
  storage_path   text,
  recipes_count  int DEFAULT 0,
  processed      boolean DEFAULT false,
  error_msg      text,
  created_at     timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_recipes_category ON public.recipes(category);
CREATE INDEX IF NOT EXISTS idx_recipes_created ON public.recipes(created_at DESC);

-- Row Level Security (leitura pública, escrita apenas via service key)
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_uploads ENABLE ROW LEVEL SECURITY;

-- Política: qualquer um pode ler receitas
CREATE POLICY "Receitas são públicas"
  ON public.recipes FOR SELECT
  USING (true);

-- Política: apenas service role pode inserir/atualizar/deletar
CREATE POLICY "Apenas admins escrevem receitas"
  ON public.recipes FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Apenas admins gerenciam uploads"
  ON public.pdf_uploads FOR ALL
  USING (auth.role() = 'service_role');

-- Storage bucket para PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-pdfs', 'recipe-pdfs', false)
ON CONFLICT (id) DO NOTHING;
