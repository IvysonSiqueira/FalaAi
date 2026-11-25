const {test}=require('node:test');const assert=require('node:assert/strict');const {backupFailure}=require('../scripts/helpers/backup-errors.cjs');
test('diagnóstico de backup classifica autenticação sem reproduzir segredos',()=>{
 const secret='DO_NOT_PRINT_PASSWORD';const input=`connection to server failed: FATAL: password authentication failed for user postgres ${secret}`;
 assert.match(backupFailure(input),/^AUTH_REJECTED/);assert.ok(!backupFailure(input).includes(secret));
});
test('diagnóstico distingue permissões, versão, TLS e rede com saída fechada',()=>{
 for(const [input,code] of [['permission denied for table protected','PRIVILEGE_DENIED'],['server version mismatch','VERSION_MISMATCH'],['SSL error secret','TLS_FAILED'],['could not translate host name private','DNS_FAILED'],['Network is unreachable','CONNECTION_FAILED'],['unknown private secret','BACKUP_FAILED']])assert.ok(backupFailure(input).startsWith(code));
});
test('conexão recusada não é diagnosticada como senha inválida ou timeout',()=>{
 const message=backupFailure('connection to server failed: Connection refused');
 assert.match(message,/porta recusou/);
 assert.ok(!message.includes('AUTH_REJECTED'));
});
test('TLS do cliente Pooler é confirmado por conninfo, sem exigir TLS interno',()=>{
 const {clientTlsConfirmed}=require('../scripts/helpers/backup-errors.cjs');
 assert.equal(clientTlsConfirmed('SSL connection (protocol: TLSv1.3, cipher: example)'),true);
 assert.equal(clientTlsConfirmed('You are connected to database postgres'),false);
});
