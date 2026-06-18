import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL || 'https://yfpdrckyuxltvznqfqgh.supabase.co';
// anon key é PÚBLICA (protegida por RLS). Pode ficar no código do painel interno.
const anon =
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmcGRyY2t5dXhsdHZ6bnFmcWdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTYwMDYsImV4cCI6MjA5MDAzMjAwNn0.PVMRz04lvMLepjv0ZCsr5mJ8K_Ux1fQlQgX1vOd4O2g';

export const supa = createClient(url, anon);

/** Redireciona pro /acesso se não houver sessão. Use no topo de cada página protegida. */
export async function requireAuth() {
  const { data } = await supa.auth.getSession();
  if (!data.session) { window.location.href = '/acesso'; return null; }
  return data.session;
}

/** Faz upload de um arquivo pro bucket evolutto-media e devolve a URL pública. */
export async function uploadMedia(file: File, folder: string): Promise<string> {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${folder}/${Date.now()}-${rand}.${ext}`;
  const { error } = await supa.storage.from('evolutto-media').upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) throw error;
  return supa.storage.from('evolutto-media').getPublicUrl(path).data.publicUrl;
}
