import NetInfo from "@react-native-community/netinfo";
import NetworkMonitor from "../../../src/services/offline/NetworkMonitor";
import { NETWORK_STATUS } from "../../../src/services/offline/constants";

// Mock NetInfo
jest.mock("@react-native-community/netinfo", () => ({
  fetch: jest.fn(),
  addEventListener: jest.fn(),
}));

describe("NetworkMonitor", () => {
  let mockUnsubscribe;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockUnsubscribe = jest.fn();
    NetInfo.addEventListener.mockReturnValue(mockUnsubscribe);
  });

  afterEach(() => {
    NetworkMonitor.destroy();
    jest.useRealTimers();
  });

  describe("initialize", () => {
    it("should fetch initial network state", async () => {
      NetInfo.fetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
        type: "wifi",
      });

      const status = await NetworkMonitor.initialize();

      expect(NetInfo.fetch).toHaveBeenCalled();
      expect(status.isOnline).toBe(true);
      expect(status.status).toBe(NETWORK_STATUS.ONLINE);
    });

    it("should subscribe to network changes", async () => {
      NetInfo.fetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
        type: "wifi",
      });

      await NetworkMonitor.initialize();

      expect(NetInfo.addEventListener).toHaveBeenCalled();
    });

    it("should report offline when not connected", async () => {
      NetInfo.fetch.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
        type: "none",
      });

      const status = await NetworkMonitor.initialize();

      expect(status.isOnline).toBe(false);
      expect(status.status).toBe(NETWORK_STATUS.OFFLINE);
    });

    it("should report offline when internet is unreachable", async () => {
      NetInfo.fetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: false,
        type: "cellular",
      });

      const status = await NetworkMonitor.initialize();

      expect(status.isOnline).toBe(false);
    });
  });

  describe("getStatus", () => {
    it("should return current network status", async () => {
      NetInfo.fetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
        type: "wifi",
      });

      await NetworkMonitor.initialize();
      const status = NetworkMonitor.getStatus();

      expect(status).toHaveProperty("isOnline");
      expect(status).toHaveProperty("connectionType");
      expect(status).toHaveProperty("status");
    });
  });

  describe("isOnline/isOffline getters", () => {
    it("should return correct online status", async () => {
      NetInfo.fetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
        type: "wifi",
      });

      await NetworkMonitor.initialize();

      expect(NetworkMonitor.isOnline).toBe(true);
      expect(NetworkMonitor.isOffline).toBe(false);
    });
  });

  describe("subscribe", () => {
    it("should add listener and return unsubscribe function", async () => {
      NetInfo.fetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
        type: "wifi",
      });

      await NetworkMonitor.initialize();

      const listener = jest.fn();
      const unsubscribe = NetworkMonitor.subscribe(listener);

      expect(typeof unsubscribe).toBe("function");

      unsubscribe();
      // Listener should be removed, but we can't easily test that without triggering an event
    });
  });

  describe("getConnectionQuality", () => {
    it("should return good for wifi", async () => {
      NetInfo.fetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
        type: "wifi",
      });

      await NetworkMonitor.initialize();

      expect(NetworkMonitor.getConnectionQuality()).toBe("good");
    });

    it("should return moderate for cellular", async () => {
      NetInfo.fetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
        type: "cellular",
      });

      await NetworkMonitor.initialize();

      expect(NetworkMonitor.getConnectionQuality()).toBe("moderate");
    });

    it("should return none when offline", async () => {
      NetInfo.fetch.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
        type: "none",
      });

      await NetworkMonitor.initialize();

      expect(NetworkMonitor.getConnectionQuality()).toBe("none");
    });
  });

  describe("destroy", () => {
    it("should unsubscribe from NetInfo", async () => {
      NetInfo.fetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
        type: "wifi",
      });

      await NetworkMonitor.initialize();
      NetworkMonitor.destroy();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe("refresh", () => {
    it("should re-fetch network state", async () => {
      NetInfo.fetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
        type: "wifi",
      });

      await NetworkMonitor.initialize();

      NetInfo.fetch.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
        type: "none",
      });

      const status = await NetworkMonitor.refresh();

      expect(NetInfo.fetch).toHaveBeenCalledTimes(2);
      expect(status.isOnline).toBe(false);
    });
  });
});
