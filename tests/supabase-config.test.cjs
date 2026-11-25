const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readSupabaseConfig } = require('../src/lib/supabase-config.ts');

// Valores deliberadamente artificiais, nunca usados para conectar a um projeto.
const url = 'https://abcdefghijklmnopqrst.supabase.co';
const publicKey = 'sb_publishable_apenas_um_valor_de_teste_local';

test('configuração ausente não cria conexão nem substitui autenticação por demonstração', () => {
  assert.equal(readSupabaseConfig(undefined, undefined), null);
  assert.equal(readSupabaseConfig('  ', ''), null);
});

test('configuração parcial falha com orientação sem mostrar a chave', () => {
  assert.throws(() => readSupabaseConfig(url, ''), /Preencha.*URL.*PUBLISHABLE_KEY/);
  assert.throws(() => readSupabaseConfig('', publicKey), /Preencha.*URL.*PUBLISHABLE_KEY/);
});

test('configuração válida identifica projeto e separa armazenamento por projeto', () => {
  const result = readSupabaseConfig(` ${url}/ `, publicKey);
  assert.equal(result.url, url);
  assert.equal(result.projectRef, 'abcdefghijklmnopqrst');
  assert.equal(result.storageKey, 'falaai-auth-abcdefghijklmnopqrst');
  assert.equal(result.publishableKey, publicKey);
  const other = readSupabaseConfig('https://tsrqponmlkjihgfedcba.supabase.co', publicKey);
  assert.notEqual(other.storageKey, result.storageKey);
});

test('recusa HTTP, URL com credencial, caminho, parâmetros ou domínio inesperado', () => {
  for (const invalid of [url.replace('https:', 'http:'), `${url}/rest/v1`, `${url}?key=x`, `${url}#frag`,
    'https://usuario:senha@abcdefghijklmnopqrst.supabase.co', 'https://outro-provedor.example', `${url}:444`]) {
    assert.throws(() => readSupabaseConfig(invalid, publicKey), /URL.*Supabase/);
  }
});

test('chaves privilegiadas e JWTs legados não podem entrar no cliente público', () => {
  for (const invalid of ['sb_secret_teste_nao_real', 'eyJhbGciOiJIUzI1NiJ9.teste.assinatura', 'qualquer-chave']) {
    assert.throws(() => readSupabaseConfig(url, invalid), (error) => {
      assert.match(error.message, /publishable key/);
      assert.ok(!error.message.includes(invalid));
      return true;
    });
  }
});
