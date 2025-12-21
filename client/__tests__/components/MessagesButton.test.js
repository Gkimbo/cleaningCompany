import React from "react";
import { render } from "@testing-library/react-native";

// Mock react-native-vector-icons
jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

// Mock react-router-native
jest.mock("react-router-native", () => ({
  useNavigate: () => jest.fn(),
}));

// Mock SocketContext
jest.mock("../../src/services/SocketContext", () => ({
  useSocket: () => ({
    onBroadcast: jest.fn(() => jest.fn()),
    onUnreadUpdate: jest.fn(() => jest.fn()),
  }),
}));

// Mock MessageService
jest.mock("../../src/services/fetchRequests/MessageClass", () => ({
  getUnreadCount: jest.fn().mockResolvedValue({ unreadCount: 0 }),
}));

import MessagesButton from "../../src/components/messaging/MessagesButton";

describe("MessagesButton Component", () => {
  const mockDispatch = jest.fn();

  const createState = (unreadCount) => ({
    currentUser: { token: "test_token", id: 1 },
    unreadCount,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Unread Badge Display", () => {
    it("should not display badge when unreadCount is 0", () => {
      const state = createState(0);
      const { queryByText } = render(
        <MessagesButton state={state} dispatch={mockDispatch} />
      );

      // Badge should not be present
      expect(queryByText("0")).toBeNull();
    });

    it("should display badge with count when unreadCount is greater than 0", () => {
      const state = createState(5);
      const { getByText } = render(
        <MessagesButton state={state} dispatch={mockDispatch} />
      );

      expect(getByText("5")).toBeTruthy();
    });

    it("should display badge with count 1", () => {
      const state = createState(1);
      const { getByText } = render(
        <MessagesButton state={state} dispatch={mockDispatch} />
      );

      expect(getByText("1")).toBeTruthy();
    });

    it("should display badge with count 99", () => {
      const state = createState(99);
      const { getByText } = render(
        <MessagesButton state={state} dispatch={mockDispatch} />
      );

      expect(getByText("99")).toBeTruthy();
    });

    it("should display '99+' when unreadCount exceeds 99", () => {
      const state = createState(100);
      const { getByText } = render(
        <MessagesButton state={state} dispatch={mockDispatch} />
      );

      expect(getByText("99+")).toBeTruthy();
    });

    it("should display '99+' when unreadCount is very large", () => {
      const state = createState(500);
      const { getByText } = render(
        <MessagesButton state={state} dispatch={mockDispatch} />
      );

      expect(getByText("99+")).toBeTruthy();
    });

    it("should not display badge when unreadCount is undefined", () => {
      const state = createState(undefined);
      const { queryByText } = render(
        <MessagesButton state={state} dispatch={mockDispatch} />
      );

      expect(queryByText("0")).toBeNull();
      expect(queryByText("99+")).toBeNull();
    });

    it("should not display badge when unreadCount is null", () => {
      const state = { currentUser: { token: "test_token", id: 1 }, unreadCount: null };
      const { queryByText } = render(
        <MessagesButton state={state} dispatch={mockDispatch} />
      );

      expect(queryByText("0")).toBeNull();
    });
  });

  describe("Badge Count Logic", () => {
    const formatUnreadCount = (count) => {
      if (!count || count <= 0) return null;
      return count > 99 ? "99+" : count.toString();
    };

    it("should return null for 0", () => {
      expect(formatUnreadCount(0)).toBeNull();
    });

    it("should return null for negative numbers", () => {
      expect(formatUnreadCount(-5)).toBeNull();
    });

    it("should return null for undefined", () => {
      expect(formatUnreadCount(undefined)).toBeNull();
    });

    it("should return null for null", () => {
      expect(formatUnreadCount(null)).toBeNull();
    });

    it("should return string for positive numbers", () => {
      expect(formatUnreadCount(5)).toBe("5");
      expect(formatUnreadCount(50)).toBe("50");
    });

    it("should return '99+' for numbers over 99", () => {
      expect(formatUnreadCount(100)).toBe("99+");
      expect(formatUnreadCount(999)).toBe("99+");
    });

    it("should return '99' for exactly 99", () => {
      expect(formatUnreadCount(99)).toBe("99");
    });
  });

  describe("Badge Visibility Logic", () => {
    const shouldShowBadge = (unreadCount) => {
      return unreadCount > 0;
    };

    it("should show badge for positive count", () => {
      expect(shouldShowBadge(1)).toBe(true);
      expect(shouldShowBadge(50)).toBe(true);
      expect(shouldShowBadge(100)).toBe(true);
    });

    it("should not show badge for zero", () => {
      expect(shouldShowBadge(0)).toBe(false);
    });

    it("should not show badge for negative", () => {
      expect(shouldShowBadge(-1)).toBe(false);
    });

    it("should not show badge for falsy values", () => {
      expect(shouldShowBadge(undefined)).toBe(false);
      expect(shouldShowBadge(null)).toBe(false);
    });
  });
});
