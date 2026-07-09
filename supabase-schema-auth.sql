-- ============================================================
-- SCHEMA ADICIONAL PARA LOGIN E VENDAS DE PLANOS (Supabase)
-- Execute este SQL no SQL Editor do seu Supabase Dashboard
-- ============================================================

-- Tabela de perfis com as compras dos planos de 10 e 20 dias
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email        text NOT NULL,
  has_plan_10  boolean DEFAULT false, -- Comprar plano de 10 dias (R$ 9)
  has_plan_20  boolean DEFAULT false, -- Comprar plano de 20 dias (R$ 12)
  created_at   timestamptz DEFAULT now()
);

-- Habilitar RLS nos perfis
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para a tabela de perfis
CREATE POLICY "Usuários podem ler seu próprio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar seu próprio perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Criar gatilho para criar o perfil do usuário automaticamente após o cadastro no Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, has_plan_10, has_plan_20)
  VALUES (new.id, new.email, false, false);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger disparada após criação de usuário no auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
