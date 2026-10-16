const assert = require('node:assert/strict');
const { test } = require('node:test');
const configureApp = require('../app.config.js');
const { expo: baseConfig } = require('../app.json');
const { build } = require('../eas.json');

function withoutMapsKey(platform, run) {
  const previousKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const previousPlatform = process.env.EAS_BUILD_PLATFORM;
  delete process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  if (platform) process.env.EAS_BUILD_PLATFORM = platform;
  else delete process.env.EAS_BUILD_PLATFORM;
  try {
    run();
  } finally {
    if (previousKey === undefined) delete process.env.GOOGLE_MAPS_ANDROID_API_KEY;
    else process.env.GOOGLE_MAPS_ANDROID_API_KEY = previousKey;
    if (previousPlatform === undefined) delete process.env.EAS_BUILD_PLATFORM;
    else process.env.EAS_BUILD_PLATFORM = previousPlatform;
  }
}

for (const platform of [undefined, 'android', 'ios']) {
  test(`configuração ${platform ?? 'web/local'} funciona sem chave e preserva a identidade EAS`, () => {
    withoutMapsKey(platform, () => {
      const result = configureApp({ config: baseConfig });
      assert.deepEqual(result, baseConfig);
      assert.equal(result.android.package, 'com.ivysonsiqueira.falaai');
      assert.ok(result.extra.eas.projectId);
      const plugins = result.plugins.map((plugin) => Array.isArray(plugin) ? plugin[0] : plugin);
      for (const plugin of ['expo-image-picker', 'expo-location', 'expo-splash-screen', 'expo-dev-client']) {
        assert.ok(plugins.includes(plugin));
      }
      assert.equal(plugins.filter((plugin) => plugin === '@maplibre/maplibre-react-native').length, 1);
      assert.ok(!plugins.includes('react-native-maps'));
      assert.equal(build.development.developmentClient, true);
      assert.equal(build.development.distribution, 'internal');
    });
  });
}
