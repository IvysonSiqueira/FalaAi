import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { SelectedPhoto } from '../types';

export const PHOTO_LIMIT = 5 * 1024 * 1024;
export const PHOTO_BUCKET = 'occurrence-photos';
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const remotePath = new RegExp(`^${uuid}/${uuid}\\.(jpg|png|webp)$`);
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// ImagePicker já está no binário. Base64 -> bytes, sem Blob, FormData ou módulo novo.
export function decodePhoto(photo: SelectedPhoto): { bytes: ArrayBuffer; mimeType: string; extension: string } {
  if (!photo || typeof photo.base64 !== 'string' || (photo.mimeType !== undefined && typeof photo.mimeType !== 'string')) throw new Error('Fotografia inválida. Selecione novamente.');
  if (photo.fileSize !== undefined && (!Number.isFinite(photo.fileSize) || photo.fileSize <= 0 || photo.fileSize > PHOTO_LIMIT)) throw new Error('Escolha uma fotografia de até 5 MiB.');
  if (photo.mimeType && !['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(photo.mimeType.toLowerCase())) throw new Error('Use fotografia JPEG, PNG ou WebP.');
  const value = photo.base64;
  if (!value || value.length % 4 || value.length > Math.ceil(PHOTO_LIMIT / 3) * 4 || /[^A-Za-z0-9+/=]/.test(value)) throw new Error('Fotografia inválida ou maior que 5 MiB. Selecione novamente.');
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  if (value.slice(0, value.length - padding).includes('=')) throw new Error('Fotografia Base64 inválida.');
  const size = value.length / 4 * 3 - padding;
  if (size <= 0 || size > PHOTO_LIMIT) throw new Error('Escolha uma fotografia de até 5 MiB.');
  const bytes = new Uint8Array(size);
  let output = 0;
  for (let index = 0; index < value.length; index += 4) {
    const number = (alphabet.indexOf(value[index]) << 18) | (alphabet.indexOf(value[index + 1]) << 12) |
      (Math.max(0, alphabet.indexOf(value[index + 2])) << 6) | Math.max(0, alphabet.indexOf(value[index + 3]));
    if (output < size) bytes[output++] = (number >> 16) & 255;
    if (output < size) bytes[output++] = (number >> 8) & 255;
    if (output < size) bytes[output++] = number & 255;
  }
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { bytes: bytes.buffer, mimeType: 'image/jpeg', extension: 'jpg' };
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return { bytes: bytes.buffer, mimeType: 'image/png', extension: 'png' };
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return { bytes: bytes.buffer, mimeType: 'image/webp', extension: 'webp' };
  throw new Error('O conteúdo do arquivo não é uma fotografia JPEG, PNG ou WebP válida.');
}

export function createOccurrencePhotos(client: SupabaseClient<Database>) {
  let cleaning: Promise<boolean> | null = null;
  async function abandon(path: string): Promise<void> {
    const { error } = await client.rpc('abandon_occurrence_photo', { p_path: path });
    if (error) throw new Error('A limpeza da foto ficará pendente para recuperação após reconectar.');
  }
  async function drain(): Promise<boolean> {
    const { data: paths, error } = await client.rpc('claim_occurrence_photo_cleanup', {});
    if (error || !paths) throw new Error('Não foi possível verificar a limpeza de fotos. Confira conexão, bucket e migração do Storage.');
    let pending = false;
    for (const path of paths) {
      if (!remotePath.test(path)) { pending = true; continue; }
      try {
        const { error: removeError } = await client.storage.from(PHOTO_BUCKET).remove([path]);
        if (removeError) { pending = true; continue; }
        // remove([]) não prova ausência: RPC confere metadata e referências no banco.
        const result = await client.rpc('finish_occurrence_photo_cleanup', { p_path: path });
        if (result.error || result.data !== true) pending = true;
      } catch { pending = true; }
    }
    const remaining = await client.from('occurrence_photo_files').select('path', { count: 'exact', head: true }).eq('state', 'cleanup');
    if (remaining.error || remaining.count === null) throw new Error('Não foi possível conferir as limpezas pendentes.');
    return pending || remaining.count > 0;
  }
  return {
    async upload(photo: SelectedPhoto): Promise<string> {
      const file = decodePhoto(photo);
      let path: string;
      try {
        const result = await client.rpc('reserve_occurrence_photo', { p_extension: file.extension });
        if (result.error || !result.data || !remotePath.test(result.data)) throw new Error('Reserva indisponível.');
        path = result.data;
      } catch { throw new Error('Não foi possível preparar a foto. Confira a conexão e se a migração do Storage foi aplicada.'); }
      try {
        const { error } = await client.storage.from(PHOTO_BUCKET).upload(path, file.bytes, { contentType: file.mimeType, upsert: false });
        if (error) throw error;
        const confirmed = await client.rpc('confirm_occurrence_photo_upload', { p_path: path });
        if (confirmed.error || confirmed.data !== true) throw new Error('Upload não confirmado no registro de arquivos.');
        return path;
      } catch {
        // Mesmo sem resposta, o caminho foi registrado ANTES do upload.
        // Se esta chamada falhar, a reserva abandonada expira em 24h para recuperação.
        try { await abandon(path); } catch { /* O registro durável permanece. */ }
        throw new Error('Não foi possível enviar a foto. Confira conexão e permissões; nenhuma conclusão de cadastro foi informada.');
      }
    },
    abandon,
    cleanup(): Promise<boolean> {
      if (!cleaning) cleaning = drain().finally(() => { cleaning = null; });
      return cleaning;
    },
    async signedUrl(path: string): Promise<string> {
      if (!remotePath.test(path)) throw new Error('Caminho remoto da fotografia inválido.');
      try {
        const { data, error } = await client.storage.from(PHOTO_BUCKET).createSignedUrl(path, 600);
        if (error || !data?.signedUrl) throw error;
        return data.signedUrl;
      } catch { throw new Error('Não foi possível acessar a fotografia. Confira sua conexão, permissões ou tente renovar o acesso.'); }
    },
  };
}
export type OccurrencePhotos = ReturnType<typeof createOccurrencePhotos>;
