const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAuthService, authErrorMessage, observeSession } = require('../src/services/auth.ts');
function client(overrides = {}) {
  return { auth: { signUp: async () => ({ data: { session: null, user: { identities: [{}] } }, error: null }),
    signInWithPassword: async () => ({ data: {}, error: null }), signOut: async () => ({ error: null }), ...overrides } };
}
test('cadastro normaliza email, envia nome e aguarda confirmação sem criar sessão local', async () => {
  let input;
  const sdk = client({ signUp: async (value) => { input = value; return { data: { session: null, user: { identities: [{}] } }, error: null }; } });
  assert.equal(await createAuthService(sdk).registerUser({ name: ' Ana ', email: ' ANA@example.com ', password: 'senha1234' }), 'confirm-email');
  assert.deepEqual(input, { email: 'ana@example.com', password: 'senha1234', options: { data: { name: 'Ana' } } });
});
test('cadastro rejeita senha menor que oito antes de acessar rede', async () => {
  let called = false;
  const service = createAuthService(client({ signUp: async () => { called = true; } }));
  await assert.rejects(service.registerUser({ name: 'Ana', email: 'ana@example.com', password: '1234567' }), /8 caracteres/);
  assert.equal(called, false);
});
test('cadastro distingue sessão imediata e resposta ofuscada de conta existente', async () => {
  const credentials = { name: 'Ana', email: 'ana@example.com', password: 'senha1234' };
  assert.equal(await createAuthService(client({ signUp: async () => ({ data: { session: {}, user: {} }, error: null }) })).registerUser(credentials), 'signed-in');
  assert.equal(await createAuthService(client({ signUp: async () => ({ data: { session: null, user: { identities: [] } }, error: null }) })).registerUser(credentials), 'check-existing');
});
test('login aguarda Supabase e traduz credenciais incorretas sem vazar mensagem técnica', async () => {
  let received;
  const service = createAuthService(client({ signInWithPassword: async (value) => { received = value; return { error: { code: 'invalid_credentials', message: 'secret internal detail' } }; } }));
  await assert.rejects(service.signIn({ email: ' ANA@example.com ', password: 'errada' }), /E-mail ou senha incorretos/);
  assert.equal(received.email, 'ana@example.com');
});
test('logout usa escopo local e propaga falha para não simular encerramento', async () => {
  let scope;
  const service = createAuthService(client({ signOut: async (options) => { scope = options.scope; return { error: { code: 'unexpected_failure' } }; } }));
  await assert.rejects(service.signOut(), /Não foi possível/);
  assert.equal(scope, 'local');
});
test('erros de confirmação, conta existente, rede e limite têm mensagens seguras', () => {
  assert.match(authErrorMessage({ code: 'email_not_confirmed' }), /Confirme/);
  assert.match(authErrorMessage({ code: 'user_already_exists' }), /já está cadastrado/);
  assert.match(authErrorMessage({ code: 'over_email_send_rate_limit' }), /Aguarde/);
  assert.match(authErrorMessage(new TypeError('Network request failed')), /conexão/);
  assert.ok(!authErrorMessage(new Error('private-token')).includes('private-token'));
});
test('evento de logout prevalece sobre restauração atrasada e cleanup cancela callbacks', async () => {
  let event, resolve;
  let unsubscribed = false;
  const values = [];
  const sdk = client({ getSession: () => new Promise((done) => { resolve = done; }),
    onAuthStateChange: (callback) => { event = callback; return { data: { subscription: { unsubscribe: () => { unsubscribed = true; } } } }; } });
  const cleanup = observeSession(sdk, (value) => values.push(value), assert.fail);
  event('SIGNED_OUT', null);
  resolve({ data: { session: { user: { id: 'old' } } }, error: null });
  await new Promise(setImmediate);
  assert.deepEqual(values, [null]);
  cleanup();
  event('SIGNED_IN', { user: { id: 'late' } });
  assert.equal(values.length, 1);
  assert.equal(unsubscribed, true);
});
test('restauração entrega sessão persistida e reporta falha sem login fictício', async () => {
  const session = { user: { id: 'persisted' } };
  const sdk = client({ getSession: async () => ({ data: { session }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) });
  let received;
  const cleanup = observeSession(sdk, (value) => { received = value; }, assert.fail);
  await new Promise(setImmediate);
  assert.equal(received, session);
  cleanup();
  sdk.auth.getSession = async () => { throw new TypeError('Network request failed'); };
  let failure;
  const stop = observeSession(sdk, assert.fail, (message) => { failure = message; });
  await new Promise(setImmediate);
  assert.match(failure, /conexão/);
  stop();
});
test('perfil usa UUID do Auth e falha fechado quando RLS/rede impede consulta', async () => {
  let table, id;
  const sdk = client();
  sdk.from = (name) => { table = name; return { select: () => ({ eq: (_column, value) => { id = value; return { single: async () => ({ data: { id: value, display_name: 'Ana' }, error: null }) }; } }) }; };
  assert.deepEqual(await createAuthService(sdk).loadProfile('auth-uuid', 'ana@example.com'), { id: 'auth-uuid', name: 'Ana', email: 'ana@example.com' });
  assert.equal(table, 'profiles');
  assert.equal(id, 'auth-uuid');
  sdk.from = () => { throw new Error('private internal error'); };
  await assert.rejects(createAuthService(sdk).loadProfile('auth-uuid', 'ana@example.com'), (error) => {
    assert.match(error.message, /carregar seu perfil/);
    assert.ok(!error.message.includes('private internal error'));
    return true;
  });
});
test('limite de email é distinguido do limite geral sem prometer prazo de liberação', () => {
  assert.match(authErrorMessage({ code: 'over_email_send_rate_limit' }), /envio de e-mails/);
  assert.doesNotMatch(authErrorMessage({ code: 'over_request_rate_limit' }), /envio de e-mails/);
});
