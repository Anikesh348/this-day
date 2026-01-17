const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.cacheStores = [
  new (require("metro-cache").FileStore)({
    root: "/tmp/metro-cache",
  }),
];

module.exports = config;
