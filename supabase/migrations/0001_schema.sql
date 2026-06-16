-- ============================================================
-- Evolutto CMS — schema inicial (Supabase / Postgres)
-- Aplicar via: supabase db push  (ou painel SQL)
-- ============================================================

-- ---------- PERFIS (estende auth.users) ----------
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  nome text,
  email text,
  papel text not null default 'Autor',      -- Admin Full | Editor | Autor | Revisor
  ativo boolean not null default true,
  foto_url text,
  created_at timestamptz not null default now()
);

-- ---------- ARTIGOS ----------
create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  seo_title text,
  seo_description text,
  tldr text,
  keywords text[] default '{}',
  category text not null default 'Geral',
  author text not null default 'Equipe Evolutto',
  author_photo text,
  cover text,
  og_image text,
  body text,                                 -- markdown/html
  faq jsonb not null default '[]',           -- [{pergunta, resposta}]
  reading_time int,
  status text not null default 'draft',      -- draft | published
  pub_date date,
  updated_date date,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists articles_status_idx on articles(status, pub_date desc);
create index if not exists articles_category_idx on articles(category);

-- ---------- ISCAS DIGITAIS (lead magnets) ----------
create table if not exists iscas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo text,                                 -- eBook | Checklist | Planilha | Playbook | Guia | Template
  descricao text,
  arquivo_url text,
  capa_url text,
  cta text default 'Baixar agora',
  downloads int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- DOWNLOADS DE ISCA (captura de lead) ----------
create table if not exists isca_downloads (
  id uuid primary key default gen_random_uuid(),
  isca_id uuid references iscas(id) on delete set null,
  nome text,
  email text,
  telefone text,
  created_at timestamptz not null default now()
);

-- ---------- BANNERS ----------
create table if not exists banners (
  id uuid primary key default gen_random_uuid(),
  titulo text,
  posicao text,                              -- Topo do site | Sidebar do blog | Rodapé | Dentro do artigo
  link text,
  imagem_url text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- HISTÓRIAS DE CLIENTES (cases / depoimentos) ----------
create table if not exists historias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  empresa text,
  foto_url text,
  depoimento text,
  resultado text,
  status text not null default 'pendente',   -- pendente | aprovado
  created_at timestamptz not null default now()
);

-- ---------- COMENTÁRIOS ----------
create table if not exists comentarios (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references articles(id) on delete cascade,
  artigo_titulo text,
  autor text,
  email text,
  texto text,
  status text not null default 'pendente',   -- pendente | aprovado | rejeitado
  created_at timestamptz not null default now()
);

-- ---------- LEADS (formulário de diagnóstico / vaga) ----------
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  nome text,
  telefone text,
  email text,
  empresa text,
  oque_faz text,
  eu_sou text,
  minha_empresa text,
  consultores text,
  projetos_entregues text,
  projetos_ativos text,
  faturamento text,
  tipo text not null default 'diagnostico',  -- diagnostico | vaga_bootcamp | isca
  origem text,                               -- URL/página de origem
  utm jsonb,
  enviado_mailchimp boolean not null default false,
  enviado_crm boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists leads_created_idx on leads(created_at desc);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
alter table profiles       enable row level security;
alter table articles       enable row level security;
alter table iscas          enable row level security;
alter table isca_downloads enable row level security;
alter table banners        enable row level security;
alter table historias      enable row level security;
alter table comentarios    enable row level security;
alter table leads          enable row level security;

-- Leitura pública do conteúdo publicado/ativo/aprovado
create policy "pub_articles"   on articles    for select using (status = 'published');
create policy "pub_iscas"      on iscas       for select using (ativo = true);
create policy "pub_banners"    on banners     for select using (ativo = true);
create policy "pub_historias"  on historias   for select using (status = 'aprovado');
create policy "pub_comentarios" on comentarios for select using (status = 'aprovado');

-- Inserts públicos (formulários) — leads, downloads e comentários (entram como pendente)
create policy "anon_leads"     on leads          for insert with check (true);
create policy "anon_downloads" on isca_downloads for insert with check (true);
create policy "anon_coment"    on comentarios    for insert with check (status = 'pendente');

-- Usuários autenticados (equipe) gerenciam tudo
create policy "auth_all_articles"   on articles    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all_iscas"      on iscas       for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all_banners"    on banners     for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all_historias"  on historias   for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all_coment"     on comentarios for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all_leads"      on leads       for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all_downloads"  on isca_downloads for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_profiles"       on profiles    for all using (auth.uid() = id) with check (auth.uid() = id);
