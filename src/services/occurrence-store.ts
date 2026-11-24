import type { Occurrence, OccurrenceDraft } from '../types';
import type { OccurrenceService } from './occurrences';

export type OccurrenceState = { items: Occurrence[]; loading: boolean; error: string | null };

// Cache compartilhado, não persistência: o servidor é a fonte dos registros.
// Mantém operações concorrentes e respostas antigas fora das telas.
export function createOccurrenceStore(api: OccurrenceService, ownerId: string, receive: (state: OccurrenceState) => void) {
  let state: OccurrenceState = { items: [], loading: true, error: null };
  let active = true;
  let writing = false;
  let revision = 0;
  let listRequest = 0;
  const changedAt = new Map<string, number>();
  const assertActive = () => { if (!active) throw new Error('A sessão mudou. Entre novamente.'); };
  function publish(patch: Partial<OccurrenceState>) {
    if (!active) return;
    state = { ...state, ...patch };
    receive(state);
  }
  function put(report: Occurrence) {
    changedAt.set(report.id, revision);
    const items = [report, ...state.items.filter((item) => item.id !== report.id)];
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    publish({ items });
  }
  function requireOwner(id: string) {
    if (state.items.find((item) => item.id === id)?.authorId !== ownerId) throw new Error('Somente o proprietário pode editar ou excluir esta ocorrência.');
  }
  async function mutate<T>(operation: () => Promise<T>, commit: (value: T) => void): Promise<T> {
    assertActive();
    if (writing) throw new Error('Aguarde a operação em andamento.');
    writing = true;
    revision += 1;
    try {
      const result = await operation();
      assertActive();
      revision += 1;
      commit(result);
      return result;
    } finally { writing = false; }
  }
  publish({});
  return {
    async refresh(): Promise<void> {
      if (!active || writing) return;
      const request = ++listRequest;
      const startedAt = revision;
      publish({ loading: true, error: null });
      try {
        const items = await api.list();
        if (active && request === listRequest) {
          // Preserva confirmações mais recentes sem perder outros itens da lista.
          const merged = new Map(items.map((item) => [item.id, item]));
          for (const [id, changed] of changedAt) {
            if (changed <= startedAt) continue;
            const current = state.items.find((item) => item.id === id);
            if (current) merged.set(id, current);
            else merged.delete(id);
          }
          publish({ items: [...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)) });
        }
      } catch (error) {
        if (active && request === listRequest) publish({ error: error instanceof Error ? error.message : 'Não foi possível carregar as ocorrências.' });
      } finally {
        if (active && request === listRequest) publish({ loading: false });
      }
    },
    async load(id: string): Promise<Occurrence | null> {
      assertActive();
      const startedAt = revision;
      const result = await api.get(id);
      assertActive();
      if ((changedAt.get(id) ?? 0) > startedAt) return state.items.find((item) => item.id === id) ?? null;
      revision += 1;
      if (result) put(result);
      else {
        changedAt.set(id, revision);
        publish({ items: state.items.filter((item) => item.id !== id) });
      }
      return result;
    },
    async create(draft: OccurrenceDraft): Promise<Occurrence> {
      return mutate(() => api.create(draft), put);
    },
    async update(id: string, draft: OccurrenceDraft): Promise<Occurrence> {
      assertActive(); requireOwner(id);
      return mutate(() => api.update(id, ownerId, draft), put);
    },
    async remove(id: string): Promise<void> {
      assertActive(); requireOwner(id);
      await mutate(() => api.remove(id, ownerId), () => {
        changedAt.set(id, revision);
        publish({ items: state.items.filter((item) => item.id !== id) });
      });
    },
    dispose() { active = false; },
  };
}
export type OccurrenceStore = ReturnType<typeof createOccurrenceStore>;
