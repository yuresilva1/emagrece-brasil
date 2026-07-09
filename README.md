# 🇧🇷 Emagrece Brasil

Planejador de alimentação fit personalizado. Gera planos de 5, 10 ou 20 dias com receitas fit e sucos detox, baseado no perfil do usuário.

## Stack

- **Next.js 14** (App Router)
- **Supabase** (PostgreSQL + Storage)
- **Vercel** (deploy)

## Como rodar localmente

### 1. Clone e instale
```bash
git clone <seu-repo>
cd fit-planner-next
npm install
```

### 2. Configure o Supabase
1. Crie um projeto em [supabase.com](https://supabase.com)
2. Vá em **SQL Editor** e execute o arquivo `supabase-schema.sql`
3. Copie as chaves do projeto em **Settings → API**

### 3. Configure as variáveis de ambiente
```bash
cp .env.local.example .env.local
# Edite .env.local com suas chaves do Supabase
```

### 4. Rode em desenvolvimento
```bash
npm run dev
```

Acesse: `http://localhost:3000`

---

## Deploy no Vercel

1. Faça push para o GitHub
2. Importe o repositório no [Vercel](https://vercel.com/new)
3. Adicione as variáveis de ambiente no painel do Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD`
4. Deploy automático! ✅

---

## Importar os PDFs de Receitas

Após o deploy, acesse `/admin` e faça upload dos seus PDFs:

1. Acesse `https://seu-app.vercel.app/admin`
2. Use a senha configurada em `ADMIN_PASSWORD`
3. Selecione o tipo (Receitas Fit ou Sucos Detox)
4. Faça upload dos PDFs — o sistema extrai as receitas automaticamente

**PDFs suportados:** Estrutura com Título → Ingredientes → Modo de Preparo

---

## Rotas

| Rota | Descrição |
|------|-----------|
| `/` | App principal (mobile) |
| `/admin` | Painel de upload de PDFs |
| `/api/recipes` | GET — receitas do banco |
| `/api/plan` | POST — gera plano personalizado |
| `/api/upload` | POST — upload e parse de PDF |

---

## Formulário do usuário

- **Nome completo**
- **Idade**
- **Peso atual** (kg)
- **Altura** (cm)
- **Quantos kg quer perder** (slider 1–50 kg)
- **O que mais incomoda** (barriga, coxas, braços, costas, quadril, rosto, pernas, corpo todo)
- **Duração do plano** (5, 10 ou 20 dias)
