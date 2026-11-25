const { getDefaultConfig } = require('expo/metro-config');
const { isolationPatterns } = require('./scripts/helpers/metro-isolation.cjs');

const config = getDefaultConfig(__dirname);
const defaults = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(defaults) ? defaults : defaults ? [defaults] : []),
  ...isolationPatterns(__dirname),
];

module.exports = config;
