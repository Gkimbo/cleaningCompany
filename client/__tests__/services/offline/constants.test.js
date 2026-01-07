import {
  MAX_OFFLINE_DURATION_MS,
  BACKGROUND_FETCH_INTERVAL_MS,
  SYNC_MAX_ATTEMPTS,
  SYNC_BASE_DELAY_MS,
  SYNC_MAX_DELAY_MS,
  PHOTO_COMPRESSION_QUALITY,
  NETWORK_DEBOUNCE_MS,
  OFFLINE_JOB_STATUS,
  SYNC_OPERATION_ORDER,
  NETWORK_STATUS,
  SYNC_STATUS,
  getRetryDelay,
} from "../../../src/services/offline/constants";

describe("Offline Constants", () => {
  describe("Time constants", () => {
    it("should have MAX_OFFLINE_DURATION_MS set to 48 hours", () => {
      expect(MAX_OFFLINE_DURATION_MS).toBe(48 * 60 * 60 * 1000);
    });

    it("should have BACKGROUND_FETCH_INTERVAL_MS set to 15 minutes", () => {
      expect(BACKGROUND_FETCH_INTERVAL_MS).toBe(15 * 60 * 1000);
    });

    it("should have reasonable network debounce time", () => {
      expect(NETWORK_DEBOUNCE_MS).toBe(2000);
    });
  });

  describe("Sync constants", () => {
    it("should have MAX_ATTEMPTS set to 5", () => {
      expect(SYNC_MAX_ATTEMPTS).toBe(5);
    });

    it("should have base delay of 1 second", () => {
      expect(SYNC_BASE_DELAY_MS).toBe(1000);
    });

    it("should have max delay of 16 seconds", () => {
      expect(SYNC_MAX_DELAY_MS).toBe(16000);
    });
  });

  describe("Photo constants", () => {
    it("should have compression quality of 0.7", () => {
      expect(PHOTO_COMPRESSION_QUALITY).toBe(0.7);
    });
  });

  describe("Job statuses", () => {
    it("should have all required job statuses", () => {
      expect(OFFLINE_JOB_STATUS.ASSIGNED).toBe("assigned");
      expect(OFFLINE_JOB_STATUS.STARTED).toBe("started");
      expect(OFFLINE_JOB_STATUS.COMPLETED).toBe("completed");
      expect(OFFLINE_JOB_STATUS.PENDING_SYNC).toBe("pending_sync");
    });
  });

  describe("Sync operation order", () => {
    it("should have operations in correct order", () => {
      expect(SYNC_OPERATION_ORDER).toEqual([
        "start",
        "accuracy",
        "before_photo",
        "checklist",
        "after_photo",
        "complete",
      ]);
    });

    it("should have start before complete", () => {
      const startIndex = SYNC_OPERATION_ORDER.indexOf("start");
      const completeIndex = SYNC_OPERATION_ORDER.indexOf("complete");
      expect(startIndex).toBeLessThan(completeIndex);
    });

    it("should have before_photo before after_photo", () => {
      const beforeIndex = SYNC_OPERATION_ORDER.indexOf("before_photo");
      const afterIndex = SYNC_OPERATION_ORDER.indexOf("after_photo");
      expect(beforeIndex).toBeLessThan(afterIndex);
    });
  });

  describe("Status enums", () => {
    it("should have all network statuses", () => {
      expect(NETWORK_STATUS.ONLINE).toBe("online");
      expect(NETWORK_STATUS.OFFLINE).toBe("offline");
      expect(NETWORK_STATUS.UNKNOWN).toBe("unknown");
    });

    it("should have all sync statuses", () => {
      expect(SYNC_STATUS.IDLE).toBe("idle");
      expect(SYNC_STATUS.SYNCING).toBe("syncing");
      expect(SYNC_STATUS.COMPLETED).toBe("completed");
      expect(SYNC_STATUS.ERROR).toBe("error");
    });
  });

  describe("getRetryDelay", () => {
    it("should return base delay for attempt 0", () => {
      expect(getRetryDelay(0)).toBe(1000);
    });

    it("should double for each attempt", () => {
      expect(getRetryDelay(1)).toBe(2000);
      expect(getRetryDelay(2)).toBe(4000);
      expect(getRetryDelay(3)).toBe(8000);
      expect(getRetryDelay(4)).toBe(16000);
    });

    it("should cap at max delay", () => {
      expect(getRetryDelay(5)).toBe(16000); // Would be 32000 without cap
      expect(getRetryDelay(10)).toBe(16000);
    });
  });
});
