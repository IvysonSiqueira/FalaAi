import type { OccurrenceDraft } from '../types';
import type { OccurrenceService } from './occurrences';
import type { OccurrencePhotos } from './occurrence-photos';

export function createOccurrenceMediaService(api: OccurrenceService, photos: OccurrencePhotos, warn: (message: string | null) => void) {
  async function recover(): Promise<void> {
    try {
      const pending = await photos.cleanup();
      warn(pending ? 'Há limpeza de fotografias pendente. Os registros confirmados estão salvos. Envios incertos podem aguardar 24 horas; reconecte e tente a limpeza novamente.' : null);
    } catch {
      warn('Não foi possível verificar a limpeza de fotografias. Confira conexão e migração do Storage e tente novamente.');
    }
  }
  async function save(draft: OccurrenceDraft, persist: (path?: string | null) => ReturnType<OccurrenceService['create']>) {
    let uploaded: string | undefined;
    try {
      if (draft.photoChange) uploaded = await photos.upload(draft.photoChange);
      const result = await persist(uploaded ?? (draft.photoChange === null ? null : undefined));
      await recover();
      return result;
    } catch (error) {
      // A RPC só abandona reservas ainda não vinculadas. Uma resposta de insert
      // perdida não permite apagar uma foto que o banco já vinculou ao relato.
      let abandonFailed = false;
      if (uploaded) {
        try { await photos.abandon(uploaded); } catch { abandonFailed = true; }
      }
      await recover();
      if (abandonFailed) warn('Uma reserva de foto aguarda recuperação no servidor. Reconecte; reservas abandonadas são elegíveis à limpeza após 24 horas.');
      throw error;
    }
  }
  return {
    async list() { await recover(); return api.list(); },
    get: api.get,
    create: (draft: OccurrenceDraft) => save(draft, (path) => api.create(draft, path)),
    update: (id: string, ownerId: string, draft: OccurrenceDraft) => save(draft, (path) => api.update(id, ownerId, draft, path)),
    async remove(id: string, ownerId: string): Promise<void> {
      // O trigger põe a foto na fila na MESMA transação do delete.
      // Não excluímos metadata de storage.objects por SQL.
      await api.remove(id, ownerId);
      await recover();
    },
    recover,
  };
}
