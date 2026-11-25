// Nunca retorna stderr bruto, credenciais ou strings de conexão.
function backupFailure(stderr = '') {
  if (/password authentication failed/i.test(stderr)) return 'AUTH_REJECTED: servidor rejeitou a senha PostgreSQL; não repetir sem corrigir a credencial local.';
  if (/permission denied/i.test(stderr)) return 'PRIVILEGE_DENIED: leitura de objeto recusada; não alterar grants automaticamente.';
  if (/server version mismatch|server version:.*pg_dump version:/is.test(stderr)) return 'VERSION_MISMATCH: cliente incompatível com servidor.';
  if (/certificate|SSL error|TLS/i.test(stderr)) return 'TLS_FAILED: negociação ou verificação TLS recusada.';
  if (/could not translate host name/i.test(stderr)) return 'DNS_FAILED: host não resolvido.';
  if (/Connection refused/i.test(stderr)) return 'CONNECTION_FAILED: a porta recusou a conexão antes de TLS/autenticação; conferir host e serviço.';
  if (/Network is unreachable|timed out|timeout expired/i.test(stderr)) return 'CONNECTION_FAILED: conexão indisponível.';
  return 'BACKUP_FAILED: falha não classificada; detalhes privados não publicados.';
}
function clientTlsConfirmed(output = '') { return /SSL connection.*protocol: TLSv1\.[23]/i.test(output); }
module.exports = { backupFailure, clientTlsConfirmed };
