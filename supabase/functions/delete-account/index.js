// Deno Edge runtime, isolado do bundle Expo. NÃO IMPLANTADO.
import { createClient } from 'npm:@supabase/supabase-js@2.119.2';
import { deleteAccount } from './core.ts';

const response = (status, state) => new Response(JSON.stringify({ state }), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
Deno.serve(async req => {
  // Dupla trava: sem deployment e sem flag, nada é removido.
  if (Deno.env.get('ACCOUNT_DELETION_ENABLED') !== 'true') return response(503, 'disabled');
  if (req.method !== 'POST') return response(405, 'method_not_allowed');
  const bearer = req.headers.get('Authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!bearer) return response(401, 'unauthorized');
  if (!req.headers.get('Content-Type')?.startsWith('application/json')) return response(400, 'invalid_request');
  try {
    // Leitura limitada: não carregar corpo arbitrariamente grande em memória.
    const reader = req.body?.getReader();
    if (!reader) return response(400, 'invalid_request');
    let body = ''; let total = 0; const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > 2048) { await reader.cancel(); return response(413, 'invalid_request'); }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    const parsed = JSON.parse(body);
    if (!parsed || Object.keys(parsed).some(key => !['password', 'confirmation'].includes(key)) ||
      typeof parsed.password !== 'string' || typeof parsed.confirmation !== 'string') return response(400, 'invalid_request');
    const url = Deno.env.get('SUPABASE_URL');
    const publicKey = Deno.env.get('SUPABASE_ANON_KEY');
    const adminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !publicKey || !adminKey) return response(503, 'configuration_required');
    const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
    const auth = createClient(url, publicKey, options);
    // Administrative key somente neste runtime. Nunca retornada ao cliente.
    const admin = createClient(url, adminKey, options);
    const result = await deleteAccount({ token: bearer, password: parsed.password, confirmation: parsed.confirmation }, {
      enabled: true,
      verify: async token => {
        const { data, error } = await auth.auth.getUser(token);
        return !error && data.user?.email ? { id: data.user.id, email: data.user.email } : null;
      },
      reauthenticate: async (user, password) => {
        const { data, error } = await auth.auth.signInWithPassword({ email: user.email, password });
        const valid = !error && data.user?.id === user.id;
        // Fecha somente a sessão criada para reautenticar; preserva a sessão original para retomada.
        if (data.session) await auth.auth.signOut({ scope: 'local' });
        return valid;
      },
      prepare: async id => {
        const { data, error } = await admin.rpc('prepare_account_deletion', { p_user: id });
        if (error || !data || typeof data.waiting !== 'boolean' || !Array.isArray(data.paths)) throw Error('Unavailable');
        return data;
      },
      remove: async paths => {
        const { error } = await admin.storage.from('occurrence-photos').remove(paths);
        if (error) throw Error('Unavailable');
      },
      acknowledge: async (id, paths) => {
        const { data, error } = await admin.rpc('ack_account_deletion_files', { p_user: id, p_paths: paths });
        if (error || !Number.isInteger(data)) throw Error('Unavailable');
      },
      finish: async id => {
        const { data, error } = await admin.rpc('finish_account_deletion', { p_user: id });
        if (error) throw Error('Unavailable'); return data === true;
      },
      deleteIdentity: async id => {
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) throw Error('Unavailable');
      },
    });
    return response(result.status, result.state);
  } catch { return response(503, 'retry_required'); }
});
