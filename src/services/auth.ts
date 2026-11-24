import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { User } from '../types';

export type Credentials = { email: string; password: string; name?: string; privacyVersion?: string };
export type RegistrationResult = 'signed-in' | 'confirm-email' | 'check-existing';
type Client = SupabaseClient<Database>;

// Nunca repassa mensagens brutas do servidor (podem conter detalhes internos).
export function authErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  switch (code) {
    case 'invalid_credentials': return 'E-mail ou senha incorretos.';
    case 'email_not_confirmed': return 'Confirme seu e-mail antes de entrar. Verifique também a pasta de spam.';
    case 'user_already_exists': case 'email_exists': return 'Este e-mail já está cadastrado. Use a opção Entrar.';
    case 'weak_password': return 'Use uma senha com pelo menos 8 caracteres e siga os requisitos do serviço.';
    case 'email_address_invalid': case 'validation_failed': return 'Confira o e-mail e os dados informados.';
    case 'over_email_send_rate_limit': case 'over_request_rate_limit': return 'Aguarde alguns minutos antes de tentar novamente. O serviço limitou as tentativas.';
    case 'signup_disabled': return 'O cadastro está desabilitado no serviço. Contate o responsável pelo projeto.';
  }
  if (error instanceof TypeError || (error && typeof error === 'object' && 'name' in error && error.name === 'AuthRetryableFetchError')) {
    return 'Não foi possível conectar ao serviço. Verifique sua conexão e tente novamente.';
  }
  return 'Não foi possível concluir a operação. Tente novamente; se persistir, contate o responsável pelo projeto.';
}

export function createAuthService(client: Client) {
  return {
    async signIn({ email, password }: Credentials): Promise<void> {
      try {
        const { error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) throw error;
      } catch (error) { throw new Error(authErrorMessage(error)); }
    },
    async registerUser({ email, password, name = '', privacyVersion }: Credentials): Promise<RegistrationResult> {
      if (!name.trim() || name.trim().length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || password.length < 8 || !password.trim()) {
        throw new Error('Informe nome, e-mail válido e senha com pelo menos 8 caracteres.');
      }
      try {
        const { data, error } = await client.auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: { name: name.trim(), ...(privacyVersion ? { privacy_accepted: true, privacy_version: privacyVersion } : {}) } } });
        if (error) throw error;
        if (data.session) return 'signed-in';
        // O Auth pode ofuscar um cadastro existente para evitar enumeração de contas.
        if (data.user?.identities?.length === 0) return 'check-existing';
        return 'confirm-email';
      } catch (error) { throw new Error(authErrorMessage(error)); }
    },
    async signOut(): Promise<void> {
      try {
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error) throw error;
      } catch (error) { throw new Error(authErrorMessage(error)); }
    },
    async loadProfile(userId: string, email: string): Promise<User> {
      try {
        const { data, error } = await client.from('profiles').select('id, display_name').eq('id', userId).single();
        if (error || !data) throw new Error('Perfil indisponível.');
        return { id: data.id, name: data.display_name, email };
      } catch {
        throw new Error('Não foi possível carregar seu perfil. Verifique a conexão e a configuração de profiles/RLS e tente novamente.');
      }
    },
  };
}

// Callback síncrono: consultas de perfil ficam fora do lock interno do Auth.
// Eventos novos prevalecem sobre um getSession que terminou atrasado.
export function observeSession(client: Client, receive: (session: Session | null) => void, fail: (message: string) => void): () => void {
  let active = true;
  let events = 0;
  const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
    if (!active) return;
    events += 1;
    receive(session);
  });
  const initialEvents = events;
  void client.auth.getSession().then(({ data, error }) => {
    if (!active || events !== initialEvents) return;
    if (error) fail(authErrorMessage(error));
    else receive(data.session);
  }).catch((error: unknown) => {
    if (active && events === initialEvents) fail(authErrorMessage(error));
  });
  return () => { active = false; subscription.unsubscribe(); };
}
