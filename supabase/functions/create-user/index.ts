// Edge Function: create-user (SEM imports — usa as APIs do Supabase via fetch p/ não travar no boot)
// Cria um usuário do CMS (Auth + perfil). Só um usuário logado pode chamar.
// Deploy pelo Dashboard (Edge Functions) com "Verify JWT" DESLIGADO.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('no', { status: 405, headers: cors });
  try {
    const authHeader = req.headers.get('Authorization') || '';
    // valida quem chamou (precisa estar logado)
    const meRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: authHeader } });
    if (!meRes.ok) return json({ error: 'não autorizado' }, 401);
    const me = await meRes.json();
    if (!me?.id) return json({ error: 'não autorizado' }, 401);

    const { nome, email, senha, papel } = await req.json();
    if (!email || !senha) return json({ error: 'email e senha são obrigatórios' }, 400);

    // cria o usuário (Admin API com service_role)
    const cRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: senha, email_confirm: true, user_metadata: { nome: nome || email.split('@')[0] } }),
    });
    const created = await cRes.json();
    if (!cRes.ok) return json({ error: created.msg || created.error_description || created.error || 'erro ao criar' }, 400);

    // atualiza o perfil (nome/papel)
    await fetch(`${SUPABASE_URL}/rest/v1/evolutto_profiles?id=eq.${created.id}`, {
      method: 'PATCH',
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ nome: nome || email.split('@')[0], papel: papel || 'Autor', email }),
    });

    return json({ ok: true, id: created.id });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
