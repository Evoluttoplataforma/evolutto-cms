// Edge Function: rebuild
// O CMS chama esta função após publicar/editar um artigo.
// Ela valida que é um usuário logado e dispara o Deploy Hook da Cloudflare
// (a URL fica guardada como SECRET, nunca no código do CMS).
//
// Deploy:  supabase functions deploy rebuild
// Secret:  supabase secrets set CF_DEPLOY_HOOK="https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/XXXX"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('no', { status: 405, headers: cors });

  try {
    // valida o usuário logado (precisa do JWT da sessão no Authorization)
    const authHeader = req.headers.get('Authorization') || '';
    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supa.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'não autorizado' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });

    const hook = Deno.env.get('CF_DEPLOY_HOOK');
    if (!hook) return new Response(JSON.stringify({ error: 'CF_DEPLOY_HOOK não configurado' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });

    const r = await fetch(hook, { method: 'POST' });
    return new Response(JSON.stringify({ ok: r.ok }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
