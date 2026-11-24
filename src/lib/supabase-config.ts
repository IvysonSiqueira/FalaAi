export type SupabaseConfig = {
  url: string;
  publishableKey: string;
  projectRef: string;
  storageKey: string;
};

// Função pura: não acessa rede, armazenamento ou variáveis de ambiente.
export function readSupabaseConfig(urlValue?: string, keyValue?: string): SupabaseConfig | null {
  const rawUrl = urlValue?.trim() ?? '';
  const publishableKey = keyValue?.trim() ?? '';
  if (!rawUrl && !publishableKey) return null;
  if (!rawUrl || !publishableKey) {
    throw new Error('Preencha EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY no .env.local.');
  }

  let url: URL;
  try { url = new URL(rawUrl); }
  catch { throw new Error('URL inválida do Supabase. Copie a Project URL do painel.'); }
  // Esta preparação aceita somente projetos hospedados no domínio padrão do Supabase.
  // Domínios personalizados/ambiente local precisam de aprovação e validação próprias.
  const host = /^([a-z0-9]{20})\.supabase\.co$/.exec(url.hostname);
  if (!host || url.protocol !== 'https:' || url.username || url.password || url.port ||
      url.search || url.hash || url.pathname !== '/') {
    throw new Error('URL inválida do Supabase. Use a Project URL HTTPS padrão, sem credenciais ou caminhos.');
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) {
    throw new Error('Use somente a publishable key do projeto. Não use chave secreta, service_role ou JWT legado.');
  }
  return { url: url.origin, publishableKey, projectRef: host[1], storageKey: `falaai-auth-${host[1]}` };
}
