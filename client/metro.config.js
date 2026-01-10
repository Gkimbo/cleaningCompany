const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Resolve better-sqlite3 to an empty module for React Native
// WatermelonDB's Node.js adapter requires it, but we only use the native adapter
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "better-sqlite3") {
    return {
      type: "empty",
    };
  }
  // Fall back to default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
