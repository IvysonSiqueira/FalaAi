import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { SupabaseConfig } from '../lib/supabase-config';

type Client = SupabaseClient<Database>;
export type DeletionKind = 'idle' | 'submitting' | 'password-required' | 'deleted' | 'pending' | 'unauthorized' |
  'session-unavailable' | 'disabled' | 'retry' | 'configuration' | 'unknown' | 'busy' | 'cleanup-required';
export type DeletionResult = { kind: DeletionKind };
export type DeletionView = DeletionResult & { open: boolean };
const DISPOSABLE_REF = 'ilkprwaxszztejsasmcs';

// Trava independente da flag remota: principal NÃO habilitado nesta entrega.
// Uma futura liberação de produção exige revisão explícita desta lista.
export function deletionEnabled(url: string | undefined, flag: string | undefined, target: string | undefined): boolean {
  return flag === 'true' && target === DISPOSABLE_REF && url?.replace(/\/$/, '') === `https://${DISPOSABLE_REF}.supabase.co`;
}

export function createAccountDeletionService(client: Client, config: SupabaseConfig, ownerId: string,
  enabled: boolean, fetcher: typeof fetch = fetch) {
  const authorized = enabled && deletionEnabled(config.url, 'true', config.projectRef) && /^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey);
  let sending = false;
  return {
    async pending(): Promise<boolean | null> {
      if (!authorized) return false;
      try {
        const { data, error } = await client.from('account_deletion_requests').select('user_id').eq('user_id', ownerId).maybeSingle();
        if (error) return null;
        return !!data;
      } catch { return null; }
    },
    async request(password: string, timeoutMs = 45000): Promise<DeletionResult> {
      if (!authorized) return { kind: 'disabled' };
      if (!password || password.length > 128) return { kind: 'password-required' };
      if (sending) return { kind: 'busy' };
      sending = true;
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), timeoutMs);
      // Race também limita SDK getSession/getUser; nem toda API SDK aceita AbortSignal.
      const timedOut = new Promise<DeletionResult>((resolve) => {
        abort.signal.addEventListener('abort', () => resolve({ kind: 'unknown' }), { once: true });
      });
      try {
        const operation = async (): Promise<DeletionResult> => {
          const { data, error } = await client.auth.getSession();
          const session = data.session;
          if (error || !session || session.user.id !== ownerId) return { kind: 'session-unavailable' };
          if (abort.signal.aborted) return { kind: 'unknown' };
          const response = await fetcher(`${config.url}/functions/v1/delete-account`, {
            method: 'POST', redirect: 'error', signal: abort.signal,
            headers: { apikey: config.publishableKey, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ password, confirmation: 'EXCLUIR MINHA CONTA' }),
          });
          const body: unknown = await response.json();
          const state = body && typeof body === 'object' && 'state' in body ? body.state : null;
          if (response.status === 200 && state === 'deleted') return { kind: 'deleted' };
          if (response.status === 202 && state === 'pending') return { kind: 'pending' };
          if (response.status === 503) {
            if (state === 'disabled') return { kind: 'disabled' };
            if (state === 'retry_required') return { kind: 'retry' };
            if (state === 'configuration_required') return { kind: 'configuration' };
          }
          if (response.status === 401) {
            // Sessão inválida após resposta perdida NÃO é comprovante de exclusão.
            const verified = await client.auth.getUser(session.access_token);
            return { kind: !verified.error && verified.data.user?.id === ownerId ? 'unauthorized' : 'session-unavailable' };
          }
          return { kind: 'unknown' };
        };
        return await Promise.race([operation().catch((): DeletionResult => ({ kind: 'unknown' })), timedOut]);
      } catch { return { kind: 'unknown' }; }
      finally { clearTimeout(timeout); sending = false; }
    },
  };
}

// Senha só é argumento transitório; nunca integra o estado, cache ou armazenamento.
export function createDeletionFlow(request: (password: string) => Promise<DeletionResult>,
  complete: () => Promise<void>, receive: (view: DeletionView) => void) {
  let view: DeletionView = { kind: 'idle', open: false };
  let active = true;
  let running = false;
  const publish = (patch: Partial<DeletionView>) => { view = { ...view, ...patch }; if (active) receive(view); };
  return {
    snapshot: () => view,
    open() { if (!running) publish({ open: true }); },
    cancel() { if (!running) publish({ open: false }); },
    restore(pending: boolean | null) { if (!running && view.kind === 'idle') publish({ kind: pending === null ? 'unknown' : pending ? 'pending' : 'idle' }); },
    dispose() { active = false; },
    activate() { active = true; },
    async submit(password: string) {
      if (running) return;
      running = true;
      const cleanupOnly = view.kind === 'cleanup-required';
      publish({ kind: 'submitting' });
      try {
        const result = cleanupOnly ? { kind: 'deleted' as const } : await request(password);
        if (result.kind === 'deleted') {
          try { await complete(); publish({ kind: 'deleted', open: false }); }
          catch { publish({ kind: 'cleanup-required' }); }
        } else publish(result);
      } catch { publish({ kind: 'unknown' }); }
      finally { running = false; }
    },
  };
}

export async function clearDeletedSession(client: Client, clearCaches: () => void): Promise<void> {
  client.auth.stopAutoRefresh();
  // SDK 2.119.2 remove a sessão local ANTES da chamada de revogação pela rede.
  try { await client.auth.signOut({ scope: 'local' }); } catch { /* conferir o estado real abaixo */ }
  const { data, error } = await client.auth.getSession();
  if (error || data.session) throw new Error('A conta foi excluída, mas a limpeza local precisa ser retomada.');
  clearCaches();
}

export const deletionMessages: Partial<Record<DeletionKind, string>> = {
  pending: 'A exclusão está em andamento. Alguns arquivos podem exigir uma espera de até 24 horas. Mantenha sua sessão e use Retomar exclusão para continuar com segurança.',
  unauthorized: 'Não foi possível confirmar sua senha. Confira a senha desta conta e tente novamente.',
  'session-unavailable': 'Sua sessão não pôde ser validada. Isso não comprova que a conta foi excluída: uma resposta anterior pode ter se perdido. Tente novamente ou saia deste aparelho e confira o acesso à conta.',
  disabled: 'A exclusão está desabilitada neste ambiente. Nenhum sucesso de exclusão foi confirmado.',
  retry: 'A limpeza pode ter sido iniciada, mas não terminou. Sua conta só será removida após resolver as dependências. Retome com a mesma conta.',
  configuration: 'O servidor de exclusão precisa de configuração. Nenhuma conclusão foi confirmada. Contate o responsável pelo projeto.',
  unknown: 'Não foi possível confirmar o resultado. A solicitação pode ter chegado ao servidor. Verifique a conexão e retome; não é necessário criar outra conta.',
  'password-required': 'Informe sua senha atual, com até 128 caracteres, para confirmar.',
  'cleanup-required': 'O servidor confirmou a exclusão. Falta limpar a sessão deste aparelho. Use Concluir limpeza local; não será enviada outra exclusão.',
};
