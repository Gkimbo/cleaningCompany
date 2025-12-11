module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@stripe/stripe-react-native|react-router-native|react-native-calendars|react-native-paper|react-native-animatable|react-native-gesture-handler|react-native-reanimated|react-native-screens|react-native-safe-area-context)",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/app/$1",
  },
  testMatch: ["**/__tests__/**/*.test.js", "**/__tests__/**/*.test.tsx"],
  collectCoverageFrom: [
    "app/**/*.{js,jsx,ts,tsx}",
    "!app/**/*.d.ts",
    "!**/node_modules/**",
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
};
