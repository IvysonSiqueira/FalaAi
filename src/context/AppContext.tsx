import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Occurrence, OccurrenceDraft, User } from '../types';
import { getSupabaseClient, observeAuthAppState } from '../lib/supabase';
import { createAuthService, observeSession, type Credentials, type RegistrationResult } from '../services/auth';

import { createOccurrencePhotos, type OccurrencePhotos } from '../services/occurrence-photos';
import { createOccurrenceMediaService } from '../services/occurrence-media';
import { createAccountDeletionService, clearDeletedSession, deletionEnabled, type DeletionResult } from '../services/account-deletion';
import { readSupabaseConfig } from '../lib/supabase-config';
import { getCategory } from '../constants/categories';
import { createOccurrenceService } from '../services/occurrences';
import { createOccurrenceStore, type OccurrenceState, type OccurrenceStore } from '../services/occurrence-store';

type AppContextValue = {
  currentUser: User | null;
  authLoading: boolean;
  authError: string | null;
  retryAuth: () => void;
  occurrences: Occurrence[];
  photoCleanupWarning: string | null;
  retryPhotoCleanup: () => Promise<void>;
  getPhotoUrl: (path: string) => Promise<string>;
  signIn: (credentials: Credentials) => Promise<void>;
  registerUser: (credentials: Credentials) => Promise<RegistrationResult>;
  signOut: () => Promise<void>;
  accountDeletionEnabled: boolean;
  requestAccountDeletion: (password: string) => Promise<DeletionResult>;
  checkAccountDeletionPending: () => Promise<boolean | null>;
  finishAccountDeletion: (ownerId: string) => Promise<void>;
  occurrencesLoading: boolean;
  occurrencesError: string | null;
  refreshOccurrences: () => Promise<void>;
  loadOccurrence: (id: string) => Promise<Occurrence | null>;
  addOccurrence: (draft: OccurrenceDraft) => Promise<Occurrence>;
  updateOccurrence: (id: string, draft: OccurrenceDraft) => Promise<Occurrence>;
  deleteOccurrence: (id: string) => Promise<void>;
};
const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [authFailure, setAuthError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const initialization = useMemo(() => {
    try { return { client: getSupabaseClient(), error: null }; }
    catch { return { client: null, error: 'Não foi possível iniciar a autenticação. Confira o .env.local e se o Development Build inclui AsyncStorage.' }; }
  }, []);
  const authError = initialization.error ?? authFailure;
  const [reports, setReports] = useState<OccurrenceState & { ownerId: string | null }>({ items: [], loading: true, error: null, ownerId: null });
  const reportStore = useRef<{ ownerId: string; store: OccurrenceStore } | null>(null);
  const [photoCleanupWarning, setPhotoCleanupWarning] = useState<string | null>(null);
  const photoService = useRef<{ ownerId: string; photos: OccurrencePhotos; recover: () => Promise<void> } | null>(null);
  const deletionService = useRef<{ ownerId: string; service: ReturnType<typeof createAccountDeletionService> } | null>(null);
  const accountDeletionEnabled = deletionEnabled(process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_ACCOUNT_DELETION_ENABLED, process.env.EXPO_PUBLIC_ACCOUNT_DELETION_PROJECT_REF);
  const identity = useRef<string | null>(null);
  const userId = session?.user.id ?? null;
  const userEmail = session?.user.email ?? '';
  const currentUser = profile?.id === userId ? profile : null;

  useEffect(() => {
    let stopSession = () => {};
    let stopRefresh = () => {};
    const client = initialization.client;
    if (!client) return;
    {
      stopSession = observeSession(client, (next) => {
        const nextId = next?.user.id ?? null;
        if (identity.current !== nextId) {
          identity.current = nextId;
          setProfile(null);
          setAuthError(null);
          reportStore.current?.store.dispose();
          reportStore.current = null;
          photoService.current = null;
          deletionService.current = null;
          setPhotoCleanupWarning(null);
          setReports({ items: [], loading: true, error: null, ownerId: null });
        }
        setSession(next);
        setRestoring(false);
      }, (message) => { setAuthError(message); setRestoring(false); });
      stopRefresh = observeAuthAppState(client);
    }
    return () => { stopSession(); stopRefresh(); };
  }, [attempt, initialization]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    // Efeito separado do callback Auth; protege respostas após logout/desmontagem.
    void createAuthService(getSupabaseClient()).loadProfile(userId, userEmail).then((user) => {
      if (active) setProfile(user);
    }).catch((error: unknown) => {
      if (active) setAuthError(error instanceof Error ? error.message : 'Não foi possível carregar seu perfil. Tente novamente.');
    });
    return () => { active = false; };
    // Renovar token não exige buscar novamente o perfil do mesmo UUID.
  }, [userId, userEmail, attempt]);

  async function signIn(credentials: Credentials) {
    await createAuthService(getSupabaseClient()).signIn(credentials);
  }
  async function registerUser(credentials: Credentials) {
    return createAuthService(getSupabaseClient()).registerUser(credentials);
  }
  async function signOut() {
    await createAuthService(getSupabaseClient()).signOut();
  }
  const activeDeletionService = useCallback(() => {
    const ownerId = identity.current;
    if (!ownerId) throw new Error('Entre novamente para confirmar sua identidade.');
    if (deletionService.current?.ownerId === ownerId) return deletionService.current.service;
    const config = readSupabaseConfig(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    if (!config) throw new Error('Serviço indisponível.');
    const service = createAccountDeletionService(getSupabaseClient(), config, ownerId, accountDeletionEnabled);
    deletionService.current = { ownerId, service };
    return service;
  }, [accountDeletionEnabled]);
  const requestAccountDeletion = useCallback(async (password: string) => {
    if (!accountDeletionEnabled) return { kind: 'disabled' as const };
    return activeDeletionService().request(password);
  }, [accountDeletionEnabled, activeDeletionService]);
  const checkAccountDeletionPending = useCallback(async () => {
    if (!accountDeletionEnabled) return false;
    return activeDeletionService().pending();
  }, [accountDeletionEnabled, activeDeletionService]);
  const finishAccountDeletion = useCallback(async (ownerId: string) => {
    if (identity.current && identity.current !== ownerId) throw new Error('A sessão mudou. Não foi alterada a conta atual.');
    await clearDeletedSession(getSupabaseClient(), () => {
      if (identity.current && identity.current !== ownerId) return;
      reportStore.current?.store.dispose();
      reportStore.current = null;
      photoService.current = null;
      deletionService.current = null;
      identity.current = null;
      setReports({ items: [], loading: false, error: null, ownerId: null });
      setPhotoCleanupWarning(null);
      setProfile(null);
      setSession(null);
      setAuthError(null);
      setRestoring(false);
    });
  }, []);
  const reportOwner = currentUser?.id ?? null;
  useEffect(() => {
    if (!reportOwner) return;
    let active = true;
    const client = getSupabaseClient();
    const photos = createOccurrencePhotos(client);
    const media = createOccurrenceMediaService(createOccurrenceService(client), photos, (message) => {
      if (active && identity.current === reportOwner) setPhotoCleanupWarning(message);
    });
    photoService.current = { ownerId: reportOwner, photos, recover: media.recover };
    const store = createOccurrenceStore(media, reportOwner,
      (value) => setReports({ ...value, items: value.items.map((item) => ({ ...item, title: getCategory(item.categoryId).label })), ownerId: reportOwner }));
    reportStore.current = { ownerId: reportOwner, store };
    void store.refresh();
    return () => {
      active = false;
      store.dispose();
      if (reportStore.current?.store === store) reportStore.current = null;
      if (photoService.current?.photos === photos) photoService.current = null;
    };
  }, [reportOwner]);

  function activeStore(): OccurrenceStore {
    const entry = reportStore.current;
    if (!entry || entry.ownerId !== identity.current) throw new Error('A sessão mudou. Entre novamente.');
    return entry.store;
  }
  const refreshOccurrences = useCallback(async () => {
    if (reportStore.current?.ownerId === identity.current) await reportStore.current?.store.refresh();
  }, []);
  const loadOccurrence = useCallback(async (id: string) => activeStore().load(id), []);
  const addOccurrence = useCallback(async (draft: OccurrenceDraft) => activeStore().create(draft), []);
  const updateOccurrence = useCallback(async (id: string, draft: OccurrenceDraft) => activeStore().update(id, draft), []);
  const deleteOccurrence = useCallback(async (id: string) => activeStore().remove(id), []);
  const getPhotoUrl = useCallback(async (path: string) => {
    const entry = photoService.current;
    if (!entry || entry.ownerId !== identity.current) throw new Error('Entre novamente para acessar a fotografia.');
    return entry.photos.signedUrl(path);
  }, []);
  const retryPhotoCleanup = useCallback(async () => {
    const entry = photoService.current;
    if (entry?.ownerId === identity.current) await entry.recover();
  }, []);
  const visibleReports = reports.ownerId === reportOwner;

  return <AppContext.Provider value={{ currentUser, photoCleanupWarning, getPhotoUrl, retryPhotoCleanup, occurrences: visibleReports ? reports.items : [],
    occurrencesLoading: !visibleReports || reports.loading, occurrencesError: visibleReports ? reports.error : null,
    refreshOccurrences, loadOccurrence, updateOccurrence, deleteOccurrence, authLoading: (restoring && !initialization.error) || (!!userId && !currentUser && !authError), authError,
    accountDeletionEnabled, requestAccountDeletion, checkAccountDeletionPending, finishAccountDeletion,
    retryAuth: () => { setRestoring(true); setAuthError(null); setAttempt((value) => value + 1); }, signIn, registerUser, signOut, addOccurrence }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp deve ser usado dentro de AppProvider.');
  return context;
}
