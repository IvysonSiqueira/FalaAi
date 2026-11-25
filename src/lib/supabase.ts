import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import type { Database } from '../types/database';
import { readSupabaseConfig } from './supabase-config';

let client: SupabaseClient<Database> | null = null;

// Cliente único usado pelo AppContext; nunca armazena a senha do formulário.
// Chamadas sem configuração falham explicitamente; não fazem fallback demonstrativo.
export function getSupabaseClient(): SupabaseClient<Database> {
  if (client) return client;
  const config = readSupabaseConfig(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  if (!config) throw new Error('Supabase não configurado. Preencha o .env.local após confirmar o projeto de destino.');
  client = createClient<Database>(config.url, config.publishableKey, {
    auth: {
      storage: AsyncStorage,
      storageKey: config.storageKey,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

// O AppProvider registra uma vez e devolve a limpeza no useEffect.
// Sem listener global: evita inscrições duplicadas durante desmontagem/Fast Refresh.
export function observeAuthAppState(supabase: SupabaseClient<Database>): () => void {
  if (Platform.OS === 'web') return () => {};
  const refresh = (state: string) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  };
  refresh(AppState.currentState);
  const subscription = AppState.addEventListener('change', refresh);
  return () => {
    subscription.remove();
    supabase.auth.stopAutoRefresh();
  };
}
