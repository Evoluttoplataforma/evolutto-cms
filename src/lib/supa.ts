import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL || 'https://yfpdrckyuxltvznqfqgh.supabase.co';
// anon key é PÚBLICA (protegida por RLS). Pode ficar no código do painel interno.
const anon =
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmcGRyY2t5dXhsdHZ6bnFmcWdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTYwMDYsImV4cCI6MjA5MDAzMjAwNn0.PVMRz04lvMLepjv0ZCsr5mJ8K_Ux1fQlQgX1vOd4O2g';

export const supa = createClient(url, anon);

/** Redireciona pro /login se não houver sessão. Use no topo de cada página protegida. */
export async function requireAuth() {
  const { data } = await supa.auth.getSession();
  if (!data.session) { window.location.href = '/login'; return null; }
  return data.session;
}
