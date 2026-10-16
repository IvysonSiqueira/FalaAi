const assert = require('node:assert/strict');
const { test } = require('node:test');
const { normalizeEmail, isValidEmail, createOccurrenceId } = require('../src/utils/validation.ts');
const { CATEGORIES, getCategory } = require('../src/constants/categories.ts');

test('identidade por e-mail ignora espaços e maiúsculas', () => {
  assert.equal(normalizeEmail('  Aluno@Exemplo.COM  '), 'aluno@exemplo.com');
  assert.notEqual(normalizeEmail('um@exemplo.com'), normalizeEmail('outro@exemplo.com'));
});

test('e-mails incompletos e com espaços são rejeitados', () => {
  for (const email of ['', '@.', 'aluno@', 'aluno.exemplo.com', 'a b@exemplo.com', 'aluno@@exemplo.com']) {
    assert.equal(isValidEmail(email), false, email);
  }
  assert.equal(isValidEmail('  Aluno+teste@exemplo.com.br  '), true);
});

test('IDs não colidem em mil cadastros no mesmo milissegundo', () => {
  const originalNow = Date.now;
  try {
    Date.now = () => 1000;
    const ids = Array.from({ length: 1000 }, createOccurrenceId);
    assert.equal(new Set(ids).size, 1000);
  } finally {
    Date.now = originalNow;
  }
});

test('categorias têm IDs distintos e metadados compartilhados pelo cadastro e mapa', () => {
  assert.equal(new Set(CATEGORIES.map((category) => category.id)).size, 6);
  for (const category of CATEGORIES) {
    assert.equal(getCategory(category.id).label, category.label);
    assert.ok(category.icon);
    assert.match(category.pinColor, /^#[\da-f]{6}$/i);
  }
});
