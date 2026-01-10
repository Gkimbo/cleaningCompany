// Jest setup file for React Native testing
import "@testing-library/react-native/extend-expect";
import "react-native-gesture-handler/jestSetup";

// Mock WatermelonDB SQLite adapter (native module not available in Jest)
jest.mock("@nozbe/watermelondb/adapters/sqlite", () => ({
  default: jest.fn().mockImplementation(() => ({
    schema: {},
    migrations: {},
    dbName: "test",
  })),
}));

// Mock the offline database module
jest.mock("./src/services/offline/database", () => ({
  database: {
    get: jest.fn(),
    write: jest.fn(),
    read: jest.fn(),
    batch: jest.fn(),
    action: jest.fn(),
  },
}));

// Mock OfflineManager
jest.mock("./src/services/offline/OfflineManager", () => ({
  default: {
    initialize: jest.fn().mockResolvedValue(undefined),
    isInitialized: jest.fn().mockReturnValue(false),
    getQueuedOperations: jest.fn().mockResolvedValue([]),
    syncPendingOperations: jest.fn().mockResolvedValue({ synced: 0, failed: 0 }),
  },
}));

// Mock AutoSyncOrchestrator
jest.mock("./src/services/offline/AutoSyncOrchestrator", () => ({
  default: {
    setAuthToken: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
  },
}));

// Mock expo-background-fetch and expo-task-manager
jest.mock("expo-background-fetch", () => ({
  BackgroundFetchStatus: {
    Available: 1,
    Restricted: 2,
    Denied: 3,
  },
  BackgroundFetchResult: {
    NoData: 1,
    NewData: 2,
    Failed: 3,
  },
  getStatusAsync: jest.fn().mockResolvedValue(1),
  registerTaskAsync: jest.fn().mockResolvedValue(undefined),
  unregisterTaskAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-task-manager", () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn().mockResolvedValue(false),
  unregisterTaskAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock the offline module's index file (for components that import from it)
// Individual offline service tests will use jest.resetModules() to get real implementations
jest.mock("./src/services/offline/index", () => ({
  OfflineManager: {
    initialize: jest.fn().mockResolvedValue(undefined),
    isInitialized: jest.fn().mockReturnValue(false),
    getQueuedOperations: jest.fn().mockResolvedValue([]),
    syncPendingOperations: jest.fn().mockResolvedValue({ synced: 0, failed: 0 }),
  },
  AutoSyncOrchestrator: {
    setAuthToken: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
  },
  BackgroundSync: {
    register: jest.fn().mockResolvedValue(undefined),
    unregister: jest.fn().mockResolvedValue(undefined),
  },
  NetworkMonitor: {
    isOnline: jest.fn().mockReturnValue(true),
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
  SyncEngine: {
    sync: jest.fn().mockResolvedValue({ synced: 0, failed: 0 }),
  },
  ConflictResolver: {
    resolve: jest.fn().mockResolvedValue({}),
  },
  useNetworkStatus: jest.fn().mockReturnValue({ isOnline: true, isOffline: false }),
}));

// Also mock for bare imports from "./src/services/offline"
jest.mock("./src/services/offline", () => ({
  OfflineManager: {
    initialize: jest.fn().mockResolvedValue(undefined),
    isInitialized: jest.fn().mockReturnValue(false),
    getQueuedOperations: jest.fn().mockResolvedValue([]),
    syncPendingOperations: jest.fn().mockResolvedValue({ synced: 0, failed: 0 }),
  },
  AutoSyncOrchestrator: {
    setAuthToken: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
  },
  BackgroundSync: {
    register: jest.fn().mockResolvedValue(undefined),
    unregister: jest.fn().mockResolvedValue(undefined),
  },
  NetworkMonitor: {
    isOnline: jest.fn().mockReturnValue(true),
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
  SyncEngine: {
    sync: jest.fn().mockResolvedValue({ synced: 0, failed: 0 }),
  },
  ConflictResolver: {
    resolve: jest.fn().mockResolvedValue({}),
  },
  useNetworkStatus: jest.fn().mockReturnValue({ isOnline: true, isOffline: false }),
}));

// Mock react-native-reanimated
jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock Stripe
jest.mock("@stripe/stripe-react-native", () => ({
  StripeProvider: ({ children }) => children,
  useStripe: () => ({
    initPaymentSheet: jest.fn().mockResolvedValue({ error: null }),
    presentPaymentSheet: jest.fn().mockResolvedValue({ error: null }),
    confirmPayment: jest.fn().mockResolvedValue({ error: null }),
  }),
}));

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Mock expo modules
jest.mock("expo-font", () => ({
  loadAsync: jest.fn(),
  isLoaded: jest.fn().mockReturnValue(true),
}));

jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

jest.mock("expo-linking", () => ({
  createURL: jest.fn(),
  useURL: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  })
);

// Silence console warnings during tests
const originalWarn = console.warn;
console.warn = (...args) => {
  if (
    typeof args[0] === "string" &&
    args[0].includes("Animated: `useNativeDriver`")
  ) {
    return;
  }
  originalWarn.apply(console, args);
};

// Mock Alert - assign directly to make it mockable/spyable
const { Alert } = require("react-native");
if (Alert) {
  Alert.alert = jest.fn();
}
