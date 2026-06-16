# Backend Supabase — Evolutto

Estrutura pronta para quando você conectar o **projeto Supabase certo da Evolutto**.

## O que tem aqui
- `migrations/0001_schema.sql` — tabelas: `profiles, articles, iscas, isca_downloads, banners, historias, comentarios, leads` + RLS.
- `functions/submit-lead/` — recebe o formulário (webhook), grava o lead e envia pro Mailchimp.

## Passo a passo (quando tiver o projeto)
1. Aplicar o schema: painel **SQL Editor** (cole o `0001_schema.sql`) ou `supabase db push`.
2. Deploy da function: `supabase functions deploy submit-lead --no-verify-jwt`.
3. Configurar os **secrets** da function (abaixo).
4. Pegar a **URL pública da function** → colocar no formulário do site (`PUBLIC_LEAD_WEBHOOK`).

## Credenciais que vou precisar de você
| Onde | Variável | O que é |
|------|----------|---------|
| Site (.env) | `PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| Site (.env) | `PUBLIC_SUPABASE_ANON_KEY` | chave anônima (pública) |
| Site (.env) | `PUBLIC_LEAD_WEBHOOK` | URL da function `submit-lead` |
| Function secret | `MAILCHIMP_API_KEY` | API key do Mailchimp |
| Function secret | `MAILCHIMP_SERVER_PREFIX` | prefixo do servidor (ex.: `us21`) |
| Function secret | `MAILCHIMP_AUDIENCE_ID` | ID da audiência/lista |
| Function secret (opcional) | `CRM_WEBHOOK_URL` | webhook externo de CRM, se houver |

> `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem no ambiente da function automaticamente.

## Fluxo do lead
```
Formulário (site) --POST JSON--> Edge Function submit-lead
   -> insere em `leads` (Supabase)
   -> adiciona/atualiza contato no Mailchimp (tag = tipo: diagnostico|vaga_bootcamp|isca)
   -> (opcional) repassa para CRM_WEBHOOK_URL
   -> responde {ok:true} -> site redireciona para /obrigado
```

## Mailchimp — merge fields esperados na audiência
Crie (Audience → Settings → Merge fields) os campos: `PHONE`, `EMPRESA`, `FATURAMENT`, `EUSOU` (texto). `FNAME`/`EMAIL` já são padrão.
