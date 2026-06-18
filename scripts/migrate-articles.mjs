// Migração 1x: 151 posts markdown -> evolutto_articles (Supabase)
// Uso:
//   cd evolutto-cms
//   SUPABASE_SERVICE_ROLE_KEY=xxxxx node scripts/migrate-articles.mjs
//
// A service_role key fica SÓ no seu terminal (ignora RLS p/ inserir).
// Pega em: Supabase -> Project Settings -> API -> service_role (secret).
// Idempotente: re-rodar atualiza pelo slug (upsert).

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.PUBLIC_SUPABASE_URL || 'https://yfpdrckyuxltvznqfqgh.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('Faltou SUPABASE_SERVICE_ROLE_KEY no ambiente.'); process.exit(1); }

const POSTS = path.resolve(process.cwd(), '../evolutto-site/src/content/posts');
const supa = createClient(URL, KEY);

const files = fs.readdirSync(POSTS).filter((f) => f.endsWith('.md'));
const rows = files.map((f) => {
  const { data: d, content } = matter(fs.readFileSync(path.join(POSTS, f), 'utf-8'));
  const toDate = (v) => (v ? new Date(v).toISOString().slice(0, 10) : null);
  return {
    slug: f.replace(/\.md$/, ''),
    title: d.title || f,
    description: d.description || null,
    seo_title: d.seoTitle || null,
    seo_description: d.seoDescription || null,
    tldr: d.tldr || null,
    keywords: Array.isArray(d.keywords) ? d.keywords : [],
    category: d.category || 'Geral',
    author: d.author || 'Equipe Evolutto',
    cover: d.cover || null,
    og_image: d.ogImage || null,
    faq: Array.isArray(d.faq) ? d.faq : [],
    status: d.draft ? 'draft' : 'published',
    pub_date: toDate(d.pubDate),
    updated_date: toDate(d.updatedDate),
    body: content.trim(),
  };
});

console.log(`Migrando ${rows.length} posts...`);
let ok = 0, fail = 0;
for (const r of rows) {
  const { error } = await supa.from('evolutto_articles').upsert(r, { onConflict: 'slug' });
  if (error) { fail++; console.error('  ✗', r.slug, error.message); }
  else { ok++; }
}
console.log(`Concluído: ${ok} ok, ${fail} falhas.`);
