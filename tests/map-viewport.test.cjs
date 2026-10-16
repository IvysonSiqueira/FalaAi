const assert = require('node:assert/strict');
const { test } = require('node:test');
const { getMapViewport, toMapPosition } = require('../src/utils/map-viewport.ts');

test('mapa vazio não inventa posição', () => {
  assert.equal(getMapViewport([]), null);
});

test('converte latitude/longitude para a ordem exigida pelo MapLibre, incluindo zero', () => {
  assert.deepEqual(toMapPosition({ latitude: -9, longitude: -35 }), [-35, -9]);
  assert.deepEqual(toMapPosition({ latitude: 0, longitude: 0 }), [0, 0]);
});

test('um ponto ou pontos coincidentes têm centro e zoom definidos', () => {
  const point = { latitude: -9, longitude: -35 };
  const expected = { center: [-35, -9], zoom: 14 };
  assert.deepEqual(getMapViewport([point]), expected);
  assert.deepEqual(getMapViewport([point, point]), expected);
});

test('bounds enquadram todos os pontos mesmo fora de ordem, sem alterar os dados', () => {
  const points = Object.freeze([
    Object.freeze({ latitude: -9, longitude: -35 }),
    Object.freeze({ latitude: -10, longitude: -34 }),
    Object.freeze({ latitude: -8, longitude: -36 }),
  ]);
  assert.deepEqual(getMapViewport([...points]), { bounds: [-36, -10, -34, -8], padding: { top: 50, right: 50, bottom: 50, left: 50 } });
  assert.deepEqual(getMapViewport([...points].reverse()), getMapViewport([...points]));
});
