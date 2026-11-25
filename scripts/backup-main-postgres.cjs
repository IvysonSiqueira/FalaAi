// Cliente PostgreSQL apenas. Nunca cria roles, migrações ou dados remotos.
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { spawnSync, execFileSync } = require('node:child_process');
const { backupFailure, clientTlsConfirmed } = require('./helpers/backup-errors.cjs');
const REF = 'wxmsqhmifqvtrlgosrjp';
function main() {
  if (!['--check', '--run'].includes(process.argv[2])) throw Error('Use --check (offline) ou --run (backup de leitura).');
  if (execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim() !== 'codex/prova-iii-supabase') throw Error('Branch incorreta.');
  const file = '.env.main-backup.local';
  if (!fs.existsSync(file)) throw Error('Configure .env.main-backup.local conforme a documentação; não envie a conexão pelo chat.');
  execFileSync('git', ['check-ignore', '--quiet', file]);
  const config = parseEnv(fs.readFileSync(file, 'utf8'));
  const url = new URL(config.FALAAI_BACKUP_DATABASE_URL);
  const password = config.FALAAI_BACKUP_DATABASE_PASSWORD || decodeURIComponent(url.password);
  if (!password) throw Error('Preencha FALAAI_BACKUP_DATABASE_PASSWORD no arquivo local protegido.');
  const direct = url.hostname === `db.${REF}.supabase.co` && decodeURIComponent(url.username) === 'postgres';
  const pooler = /^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(url.hostname) && decodeURIComponent(url.username) === `postgres.${REF}`;
  if (config.FALAAI_BACKUP_PROJECT_REF !== REF || !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !(direct || pooler) || !password || url.pathname !== '/postgres' || url.hash ||
      url.searchParams.get('sslmode') !== 'require' || [...url.searchParams.keys()].some(k => k !== 'sslmode') ||
      (url.port && url.port !== '5432')) throw Error('Conexão bloqueada: use destino principal exato, TLS e porta direta/session 5432.');
  const directory = config.FALAAI_BACKUP_PG_BIN || '/opt/homebrew/opt/libpq@17/bin';
  if (config.FALAAI_BACKUP_SERVER_MAJOR !== '17') throw Error('Versão esperada do principal deve ser 17.');
  const dump = path.join(directory, 'pg_dump');
  const restore = path.join(directory, 'pg_restore');
  for (const executable of [dump, restore]) {
    const result = spawnSync(executable, ['--version'], { encoding: 'utf8' });
    if (result.status !== 0) throw Error('Clientes pg_dump/pg_restore indisponíveis.');
    if (!/PostgreSQL\) 17\./.test(result.stdout)) throw Error('Use clientes da família 17 para recuperação no principal PostgreSQL 17.');
  }
  console.log('PASSOU: configuração local ignorada, destino principal fixo, clientes disponíveis; nenhuma conexão no --check.');
  if (process.argv[2] === '--check') return;
  const root = path.join('.artifacts', 'backups', new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  for (const dir of ['.artifacts', '.artifacts/backups', root]) fs.chmodSync(dir, 0o700);
  const archive = path.resolve(root, 'principal.partial');
  const completedArchive = path.resolve(root, 'principal.dump');
  const fail = message => {
    fs.writeFileSync(path.join(root, 'status.json'), JSON.stringify({ completed: false, usableForRecovery: false, diagnostic: message }), { mode: 0o600 });
    throw Error(message);
  };
  // Dados de conexão somente no ambiente do subprocesso, nunca em argv/logs.
  const env = { PATH: process.env.PATH, HOME: process.env.HOME, PGHOST: url.hostname,
    PGPORT: '5432', PGUSER: decodeURIComponent(url.username), PGPASSWORD: password,
    PGDATABASE: 'postgres', LC_ALL: 'C', PGOPTIONS: '-c default_transaction_read_only=on', PGSSLMODE: 'require', PGCONNECT_TIMEOUT: '15', PGAPPNAME: 'FalaAi-readonly-backup' };
  const probe = spawnSync(path.join(directory, 'psql'), ['-X', '-w', '-A', '-t', '-c',
    "select json_build_object('version',current_setting('server_version'),'tls',(select ssl from pg_stat_ssl where pid=pg_backend_pid()),'authRead',has_table_privilege(current_user,'auth.users','SELECT'),'identitiesRead',has_table_privilege(current_user,'auth.identities','SELECT'))", '-c', '\\conninfo'],
    { env, encoding: 'utf8', timeout: 30000 });
  if (probe.status !== 0) fail(backupFailure(String(probe.stderr || '')));
  let connection; try { connection = JSON.parse(probe.stdout.split('\n').find(line => line.startsWith('{')) || ''); } catch { fail('CONNECTION_CHECK_FAILED: resposta de verificação inválida.'); }
  if (!connection.version.startsWith('17.') || !clientTlsConfirmed(probe.stdout) || !connection.authRead || !connection.identitiesRead) fail('PRECONDITION_FAILED: conferir versão, TLS e privilégios de leitura.');
  console.log('PASSOU: autenticação, TLS, servidor 17 e SELECT em Auth/identities.');
  const result = spawnSync(dump, ['--format=custom', '--no-password', '--file', archive], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  if (fs.existsSync(archive)) fs.chmodSync(archive, 0o600);
  if (result.status !== 0) fail(backupFailure(String(result.stderr || '')));
  const listed = spawnSync(restore, ['--list', archive], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (listed.status !== 0 || !/TABLE DATA auth users/.test(listed.stdout) || !/TABLE DATA public occurrences/.test(listed.stdout)) fail('INVALID_ARCHIVE: arquivo sem entradas obrigatórias de Auth/aplicação; interromper.');
  const decoded = spawnSync(restore, ['--file', process.platform === 'win32' ? 'NUL' : '/dev/null', archive], { stdio: ['ignore', 'pipe', 'pipe'] });
  if (decoded.status !== 0) fail('INVALID_ARCHIVE: decodificação integral recusada.');
  fs.renameSync(archive, completedArchive);
  fs.writeFileSync(path.join(root, 'archive-list.txt'), listed.stdout, { mode: 0o600 });
  fs.writeFileSync(path.join(root, 'status.json'), JSON.stringify({ ref: REF, completed: true, archiveReadable: true, fullyDecoded: true,
    actualRestoreTested: false, includes: 'Schemas e dados PostgreSQL visíveis ao usuário da conexão; ACLs e owners preservados no arquivo',
    excludes: 'Bytes Storage, chaves/configuração do projeto, roles globais e infraestrutura do provedor' }, null, 2), { mode: 0o600 });
  console.log('PASSOU: dump concluído e índice legível; NÃO comprova restauração. Arquivo privado: ' + completedArchive);
}
try { main(); } catch (error) {
  const safe = error instanceof Error && !/postgres(?:ql)?:\/\//.test(error.message) ? error.message : 'Falha segura; detalhes omitidos.';
  console.error(safe); process.exitCode = 1;
}
