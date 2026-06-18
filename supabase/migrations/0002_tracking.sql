-- =============================================================================
-- tracking-kit — Supabase schema (V1.0.0)
-- =============================================================================
-- 1 instância de Supabase por cliente (V1). Schema deixado pronto pra migrar
-- pra banco central no futuro (basta ativar RLS de 02-rls.sql).
--
-- Rode este script no SQL Editor do projeto Supabase do cliente.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- TABELA PRINCIPAL: tracking_events
-- ---------------------------------------------------------------------------
create table if not exists public.evolutto_tracking_events (
  id                    uuid primary key default gen_random_uuid(),

  -- versionamento do payload (vindo de _v do kit)
  kit_version           text,

  -- identificação do tenant (genérico, mesmo em banco isolado)
  client_name           text not null,

  -- identificação do visitante / sessão / evento
  event_id              text not null,        -- vem do browser (UUID)
  event_name            text not null,        -- PageView, Lead, Purchase, Scroll, ...
  event_time            timestamptz not null default now(),
  visitor_id            text,                 -- UUID persistente (cookie 2 anos)
  session_id            text,
  external_id           text,                 -- SHA-256(email) hex

  -- atribuição: FIRST-TOUCH
  ft_utm_source         text,
  ft_utm_medium         text,
  ft_utm_campaign       text,
  ft_utm_content        text,
  ft_utm_term           text,
  ft_utm_id             text,

  -- atribuição: LAST-TOUCH (o que a pessoa "trouxe" nessa visita)
  lt_utm_source         text,
  lt_utm_medium         text,
  lt_utm_campaign       text,
  lt_utm_content        text,
  lt_utm_term           text,
  lt_utm_id             text,

  -- click IDs (last-touch principal; first-touch fica em journey/JSONB)
  gclid                 text,
  gbraid                text,
  wbraid                text,
  gad_campaignid        text,
  gad_source            text,
  fbclid                text,
  ctwa_clid             text,   -- Click to WhatsApp Ads
  ttclid                text,
  msclkid               text,
  li_fat_id             text,
  twclid                text,
  sck                   text,

  -- cookies de plataforma
  fbp                   text,
  fbc                   text,
  ttp                   text,
  ga_client_id          text,

  -- lead (hash quando aplicável)
  email                 text,            -- raw lowercase trimmed (use cuidado / LGPD)
  email_hash            text,            -- SHA-256 hex (Meta Advanced Matching)
  phone                 text,
  phone_hash            text,
  first_name            text,
  last_name             text,

  -- geo (best-effort via ipapi)
  geo_city              text,
  geo_state             text,
  geo_zip               text,
  geo_country           text,
  ip_address            text,            -- vem do header x-forwarded-for no n8n
  user_agent            text,

  -- página
  page_url              text,
  page_path             text,
  page_hostname         text,
  page_title            text,
  referrer              text,
  landing_page          text,            -- primeira página da jornada
  origin_page           text,            -- primeira referência externa
  first_visit           timestamptz,

  -- device fingerprint
  device_type           text,            -- mobile/desktop/tablet
  platform              text,
  language              text,
  timezone              text,
  screen_w              int,
  screen_h              int,
  viewport_w            int,
  viewport_h            int,
  color_depth           int,
  pixel_ratio           numeric,
  connection_type       text,
  cookies_enabled       boolean,
  do_not_track          boolean,

  -- jornada multi-touch (últimos 20 toques)
  journey               jsonb,

  -- propriedades específicas do evento (value, currency, items, etc.)
  properties            jsonb,

  -- payload bruto (debug / migrações futuras)
  raw                   jsonb,

  created_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ÍNDICES
-- ---------------------------------------------------------------------------
create unique index if not exists ux_evolutto_tracking_events_event_id
  on public.evolutto_tracking_events (event_id);

create index if not exists ix_evolutto_tracking_events_client_time
  on public.evolutto_tracking_events (client_name, event_time desc);

create index if not exists ix_evolutto_tracking_events_visitor
  on public.evolutto_tracking_events (visitor_id, event_time desc);

create index if not exists ix_evolutto_tracking_events_session
  on public.evolutto_tracking_events (session_id);

create index if not exists ix_evolutto_tracking_events_event_name
  on public.evolutto_tracking_events (event_name, event_time desc);

create index if not exists ix_evolutto_tracking_events_email_hash
  on public.evolutto_tracking_events (email_hash);

create index if not exists ix_evolutto_tracking_events_ft_source
  on public.evolutto_tracking_events (ft_utm_source, ft_utm_medium, ft_utm_campaign);

create index if not exists ix_evolutto_tracking_events_lt_source
  on public.evolutto_tracking_events (lt_utm_source, lt_utm_medium, lt_utm_campaign);

create index if not exists ix_evolutto_tracking_events_gclid
  on public.evolutto_tracking_events (gclid) where gclid is not null;

create index if not exists ix_evolutto_tracking_events_fbclid
  on public.evolutto_tracking_events (fbclid) where fbclid is not null;

create index if not exists ix_evolutto_tracking_events_ctwa
  on public.evolutto_tracking_events (ctwa_clid) where ctwa_clid is not null;

create index if not exists ix_evolutto_tracking_events_properties_gin
  on public.evolutto_tracking_events using gin (properties);

-- ---------------------------------------------------------------------------
-- DEAD LETTER: eventos que falharam no envio pras plataformas externas
-- ---------------------------------------------------------------------------
create table if not exists public.evolutto_tracking_events_failed (
  id              uuid primary key default gen_random_uuid(),
  client_name     text not null,
  event_id        text,
  event_name      text,
  channel         text not null,     -- 'meta_capi' | 'google_ads' | 'ga4_mp' | 'tiktok_events'
  attempts        int not null default 1,
  last_error      text,
  payload         jsonb not null,
  created_at      timestamptz not null default now(),
  last_attempt_at timestamptz not null default now(),
  resolved_at     timestamptz
);

create index if not exists ix_evolutto_tef_client_channel
  on public.evolutto_tracking_events_failed (client_name, channel, created_at desc);

create index if not exists ix_evolutto_tef_pending
  on public.evolutto_tracking_events_failed (channel, resolved_at)
  where resolved_at is null;

-- ---------------------------------------------------------------------------
-- Comentários
-- ---------------------------------------------------------------------------
comment on table public.evolutto_tracking_events is
  'Eventos rastreados pelo tracking-kit. event_id é UUID gerado no browser e compartilhado com browser↔servidor pra deduplicação.';
comment on column public.evolutto_tracking_events.client_name is
  'Slug do cliente. Em modo banco-isolado é constante; em multi-tenant (V2) é o tenant_id.';
comment on column public.evolutto_tracking_events.journey is
  'Array dos últimos 20 toques (UTM + referrer + page + ts). Usado pelas views de atribuição multi-touch.';
