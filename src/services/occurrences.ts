import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { Occurrence, OccurrenceDraft } from '../types';

type Row = Database['public']['Tables']['occurrences']['Row'];
type Input = Database['public']['Tables']['occurrences']['Insert'];
const columns = 'id,author_id,category_id,description,location,latitude,longitude,photo_path,status,created_at,updated_at';
const pageSize = 500;

export function toOccurrence(row: Row): Occurrence {
  return {
    id: row.id, authorId: row.author_id, author: '', categoryId: row.category_id,
    title: '', description: row.description, location: row.location ?? '',
    coordinates: row.latitude !== null && row.longitude !== null ? { latitude: row.latitude, longitude: row.longitude } : null,
    photo: null, photoPath: row.photo_path ?? null, status: row.status, createdAt: row.created_at,
  };
}

function payload(draft: OccurrenceDraft): Input {
  // Lista explícita impede enviar proprietário, foto local, ID, status ou datas.
  if (!['buraco', 'iluminacao', 'lixo', 'vazamento', 'calcada', 'outros'].includes(draft.categoryId)) throw new Error('Selecione uma categoria válida.');
  const description = draft.description.trim();
  const location = draft.location.trim();
  const point = draft.coordinates;
  if (description.length < 20 || description.length > 400) throw new Error('A descrição deve ter entre 20 e 400 caracteres úteis.');
  if (location.length > 200 || (!location && !point)) throw new Error('Informe um endereço de até 200 caracteres ou capture o GPS.');
  if (point && (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180)) throw new Error('As coordenadas GPS são inválidas. Capture novamente ou use um endereço.');
  return { category_id: draft.categoryId, description, location: location || null, latitude: point?.latitude ?? null, longitude: point?.longitude ?? null };
}

function failure(error: unknown): Error {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === '42501') return new Error('Sua sessão não tem permissão para esta operação. Entre novamente e confira as políticas RLS.');
  if (code === '23514' || code === '22001') return new Error('O banco recusou os dados. Confira categoria, descrição e localização.');
  if (code === 'PGRST301' || code === 'PGRST303') return new Error('Sua sessão expirou. Entre novamente.');
  return new Error('Não foi possível confirmar a operação com o servidor. Verifique sua conexão e atualize a lista antes de tentar novamente.');
}
const missing = () => new Error('Ocorrência não encontrada ou sem permissão para alterar este registro.');

export function createOccurrenceService(client: SupabaseClient<Database>) {
  return {
    async list(): Promise<Occurrence[]> {
      const rows: Occurrence[] = [];
      try {
        for (let offset = 0; ; offset += pageSize) {
          const { data, error } = await client.from('occurrences').select(columns)
            .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + pageSize - 1);
          if (error || !data) throw error;
          rows.push(...data.map(toOccurrence));
          if (data.length < pageSize) return [...new Map(rows.map((item) => [item.id, item])).values()];
        }
      } catch (error) { throw failure(error); }
    },
    async get(id: string): Promise<Occurrence | null> {
      try {
        const { data, error } = await client.from('occurrences').select(columns).eq('id', id).maybeSingle();
        if (error) throw error;
        return data ? toOccurrence(data) : null;
      } catch (error) { throw failure(error); }
    },
    async create(draft: OccurrenceDraft, photoPath?: string | null): Promise<Occurrence> {
      const input = payload(draft);
      if (photoPath !== undefined) input.photo_path = photoPath;
      let row: Row | null;
      try {
        const { data, error } = await client.from('occurrences').insert(input).select(columns).single();
        if (error) throw error;
        row = data;
      } catch (error) { throw failure(error); }
      if (!row) throw missing();
      return toOccurrence(row);
    },
    async update(id: string, ownerId: string, draft: OccurrenceDraft, photoPath?: string | null): Promise<Occurrence> {
      const input = payload(draft);
      if (photoPath !== undefined) input.photo_path = photoPath;
      let row: Row | null;
      try {
        const { data, error } = await client.from('occurrences').update(input).eq('id', id).eq('author_id', ownerId).select(columns).maybeSingle();
        if (error) throw error;
        row = data;
      } catch (error) { throw failure(error); }
      if (!row) throw missing();
      return toOccurrence(row);
    },
    async remove(id: string, ownerId: string): Promise<void> {
      let deleted: { id: string }[] | null;
      try {
        const { data, error } = await client.from('occurrences').delete().eq('id', id).eq('author_id', ownerId).select('id');
        if (error) throw error;
        deleted = data;
      } catch (error) { throw failure(error); }
      if (!deleted?.length) throw missing();
    },
  };
}
export type OccurrenceService = ReturnType<typeof createOccurrenceService>;
