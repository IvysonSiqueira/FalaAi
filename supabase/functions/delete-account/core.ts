// Núcleo puro testável. Nenhum SDK, senha ou token é persistido/logado aqui.
type Identity = { id: string; email: string };
export type DeletionDependencies = {
  enabled: boolean;
  verify: (token: string) => Promise<Identity | null>;
  reauthenticate: (user: Identity, password: string) => Promise<boolean>;
  prepare: (id: string) => Promise<{ waiting: boolean; paths: string[] }>;
  remove: (paths: string[]) => Promise<void>;
  acknowledge: (id: string, paths: string[]) => Promise<void>;
  finish: (id: string) => Promise<boolean>;
  deleteIdentity: (id: string) => Promise<void>;
};
export async function deleteAccount(
  input: { token: string; password: string; confirmation: string }, deps: DeletionDependencies,
): Promise<{ status: number; state: string }> {
  if (!deps.enabled) return { status: 503, state: 'disabled' };
  if (!input.token || !input.password || input.password.length > 128 || input.confirmation !== 'EXCLUIR MINHA CONTA') return { status: 400, state: 'invalid_request' };
  try {
    const user = await deps.verify(input.token);
    if (!user || !await deps.reauthenticate(user, input.password)) return { status: 401, state: 'unauthorized' };
    // Identidade sempre vem do Auth. Nunca aceita UUID escolhido pelo cliente.
    const work = await deps.prepare(user.id);
    if (work.waiting) return { status: 202, state: 'pending' };
    if (!Array.isArray(work.paths) || work.paths.length > 100 || work.paths.some(path => !path.startsWith(user.id + '/') || path.includes('..'))) throw new Error('Invalid scope');
    if (work.paths.length) {
      // Mesmo quando remove falha após exclusão parcial, o servidor confirma
      // somente ausências reais. Se o ACK falhar, repetir remove é seguro.
      try { await deps.remove(work.paths); }
      finally { await deps.acknowledge(user.id, work.paths); }
    }
    if (!await deps.finish(user.id)) return { status: 202, state: 'pending' };
    await deps.deleteIdentity(user.id);
    return { status: 200, state: 'deleted' };
  } catch {
    // O trabalho SQL permanece para retomada. Não anuncia sucesso parcial.
    return { status: 503, state: 'retry_required' };
  }
}
