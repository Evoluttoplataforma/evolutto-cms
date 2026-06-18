import fs from 'node:fs';
import path from 'node:path';

// Lê os artigos reais do blog (bridge local até o Supabase).
const POSTS_DIR = path.resolve(process.cwd(), '../evolutto-site/src/content/posts');

export interface CmsPost {
  slug: string;
  title: string;
  description: string;
  category: string;
  author: string;
  pubDate: string; // YYYY-MM-DD
  draft: boolean;
  cover?: string;
  tldr?: string;
  body: string; // conteúdo (markdown/html)
}

function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    data[kv[1]] = v;
  }
  return { data, body: m[2] };
}

export function getCmsPosts(): CmsPost[] {
  let files: string[] = [];
  try {
    files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
  const posts = files.map((f) => {
    const raw = fs.readFileSync(path.join(POSTS_DIR, f), 'utf-8');
    const { data, body } = parseFrontmatter(raw);
    return {
      slug: f.replace(/\.md$/, ''),
      title: data.title || f,
      description: data.description || '',
      category: data.category || 'Geral',
      author: data.author || 'Equipe Evolutto',
      pubDate: (data.pubDate || '').slice(0, 10),
      draft: data.draft === 'true',
      cover: data.cover || undefined,
      tldr: data.tldr || undefined,
      body,
    } as CmsPost;
  });
  return posts.sort((a, b) => (a.pubDate < b.pubDate ? 1 : -1));
}

export function getCmsPost(slug: string): CmsPost | undefined {
  return getCmsPosts().find((p) => p.slug === slug);
}

export const fmtBR = (iso: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
