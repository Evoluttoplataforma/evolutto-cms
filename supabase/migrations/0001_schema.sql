-- ============================================================
-- Evolutto CMS — schema inicial (Supabase / Postgres)
-- Projeto compartilhado → todas as tabelas usam prefixo evolutto_
-- ============================================================

-- ---------- PERFIS (estende auth.users) ----------
create table if not exists evolutto_profiles (
  id uuid references auth.users on delete cascade primary key,
  nome text,
  email text,
  papel text not null default 'Autor',      -- Admin Full | Editor | Autor | Revisor
  ativo boolean not null default true,
  foto_url text,
  created_at timestamptz not null default now()
);

-- ---------- ARTIGOS ----------
create table if not exists evolutto_articles (
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
  body text,
  faq jsonb not null default '[]',
  reading_time int,
  status text not null default 'draft',      -- draft | published
  pub_date date,
  updated_date date,
  created_by uuid references evolutto_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists evolutto_articles_status_idx on evolutto_articles(status, pub_date desc);
create index if not exists evolutto_articles_category_idx on evolutto_articles(category);

-- ---------- ISCAS DIGITAIS ----------
create table if not exists evolutto_iscas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo text,
  descricao text,
  arquivo_url text,
  capa_url text,
  cta text default 'Baixar agora',
  downloads int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- DOWNLOADS DE ISCA (captura de lead) ----------
create table if not exists evolutto_isca_downloads (
  id uuid primary key default gen_random_uuid(),
  isca_id uuid references evolutto_iscas(id) on delete set null,
  nome text,
  email text,
  telefone text,
  created_at timestamptz not null default now()
);

-- ---------- BANNERS ----------
create table if not exists evolutto_banners (
  id uuid primary key default gen_random_uuid(),
  titulo text,
  posicao text,
  link text,
  imagem_url text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- HISTÓRIAS DE CLIENTES ----------
create table if not exists evolutto_historias (
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
create table if not exists evolutto_comentarios (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references evolutto_articles(id) on delete cascade,
  artigo_titulo text,
  autor text,
  email text,
  texto text,
  status text not null default 'pendente',   -- pendente | aprovado | rejeitado
  created_at timestamptz not null default now()
);

-- ---------- LEADS (formulário) ----------
create table if not exists evolutto_leads (
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
  origem text,
  utm jsonb,
  enviado_mailchimp boolean not null default false,
  enviado_crm boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists evolutto_leads_created_idx on evolutto_leads(created_at desc);

-- ============================================================
-- RLS
-- ============================================================
alter table evolutto_profiles       enable row level security;
alter table evolutto_articles       enable row level security;
alter table evolutto_iscas          enable row level security;
alter table evolutto_isca_downloads enable row level security;
alter table evolutto_banners        enable row level security;
alter table evolutto_historias      enable row level security;
alter table evolutto_comentarios    enable row level security;
alter table evolutto_leads          enable row level security;

-- Leitura pública do conteúdo publicado/ativo/aprovado
create policy "evo_pub_articles"    on evolutto_articles    for select using (status = 'published');
create policy "evo_pub_iscas"       on evolutto_iscas       for select using (ativo = true);
create policy "evo_pub_banners"     on evolutto_banners     for select using (ativo = true);
create policy "evo_pub_historias"   on evolutto_historias   for select using (status = 'aprovado');
create policy "evo_pub_comentarios" on evolutto_comentarios for select using (status = 'aprovado');

-- Inserts públicos (formulários)
create policy "evo_anon_leads"     on evolutto_leads          for insert with check (true);
create policy "evo_anon_downloads" on evolutto_isca_downloads for insert with check (true);
create policy "evo_anon_coment"    on evolutto_comentarios    for insert with check (status = 'pendente');

-- Equipe autenticada gerencia tudo
create policy "evo_auth_articles"  on evolutto_articles       for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "evo_auth_iscas"     on evolutto_iscas          for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "evo_auth_banners"   on evolutto_banners        for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "evo_auth_historias" on evolutto_historias      for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "evo_auth_coment"    on evolutto_comentarios    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "evo_auth_leads"     on evolutto_leads          for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "evo_auth_downloads" on evolutto_isca_downloads for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "evo_auth_profiles"  on evolutto_profiles       for all using (auth.uid() = id) with check (auth.uid() = id);
