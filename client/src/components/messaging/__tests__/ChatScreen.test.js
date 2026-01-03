import React from "react";
import { render, waitFor } from "@testing-library/react-native";

// Mock react-router-native
const mockNavigate = jest.fn();
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ conversationId: "1" }),
}));

// Mock MessageService
const mockGetMessages = jest.fn();
const mockMarkAsRead = jest.fn();
const mockGetUnreadCount = jest.fn();
const mockSendMessage = jest.fn();

jest.mock("../../../services/fetchRequests/MessageClass", () => ({
  getMessages: (...args) => mockGetMessages(...args),
  markAsRead: (...args) => mockMarkAsRead(...args),
  getUnreadCount: (...args) => mockGetUnreadCount(...args),
  sendMessage: (...args) => mockSendMessage(...args),
}));

// Mock SocketContext
const mockJoinConversation = jest.fn();
const mockLeaveConversation = jest.fn();
const mockOnNewMessage = jest.fn(() => jest.fn());
const mockOnMessageReaction = jest.fn(() => jest.fn());
const mockOnMessageDeleted = jest.fn(() => jest.fn());
const mockOnMessageRead = jest.fn(() => jest.fn());
const mockOnConversationTitleChanged = jest.fn(() => jest.fn());

jest.mock("../../../services/SocketContext", () => ({
  useSocket: () => ({
    joinConversation: mockJoinConversation,
    leaveConversation: mockLeaveConversation,
    onNewMessage: mockOnNewMessage,
    onMessageReaction: mockOnMessageReaction,
    onMessageDeleted: mockOnMessageDeleted,
    onMessageRead: mockOnMessageRead,
    onConversationTitleChanged: mockOnConversationTitleChanged,
  }),
}));

// Mock Feather icon
jest.mock("react-native-vector-icons/Feather", () => {
  const { Text } = require("react-native");
  return ({ name, ...props }) => <Text {...props}>{name}</Text>;
});

// Mock UserContext
const mockDispatch = jest.fn();
let mockState = {
  currentUser: { token: "test-token", userId: "1" },
  account: null,
};

jest.mock("../../../context/UserContext", () => {
  const React = require("react");
  return {
    UserContext: React.createContext({
      state: {
        currentUser: { token: "test-token", userId: "1" },
        account: null,
      },
      dispatch: jest.fn(),
    }),
  };
});

// We need to re-mock useContext to return our test values
const originalUseContext = React.useContext;
jest.spyOn(React, "useContext").mockImplementation((context) => {
  // Check if it's the UserContext by looking at the structure
  if (context && context._currentValue && context._currentValue.state) {
    return { state: mockState, dispatch: mockDispatch };
  }
  return originalUseContext(context);
});

import ChatScreen from "../ChatScreen";

describe("ChatScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMarkAsRead.mockResolvedValue({});
    mockGetUnreadCount.mockResolvedValue({ unreadCount: 0 });
    mockState = {
      currentUser: { token: "test-token", userId: "1" },
      account: null,
    };
  });

  describe("Completed Appointment Messaging Restriction", () => {
    it("should show disabled banner when appointment is completed", async () => {
      mockGetMessages.mockResolvedValue({
        messages: [],
        conversation: {
          id: 1,
          conversationType: "appointment",
          appointment: {
            id: 100,
            completed: true,
            date: "2024-01-15",
          },
          participants: [{ userId: 1, user: { id: 1, username: "user1" } }],
        },
      });

      const { getByText, queryByPlaceholderText } = render(<ChatScreen />);

      await waitFor(() => {
        expect(mockGetMessages).toHaveBeenCalled();
      });

      // Should show the disabled message
      await waitFor(() => {
        expect(
          getByText("This appointment is complete, messaging for it is disabled.")
        ).toBeTruthy();
      });

      // Should NOT show the input field
      expect(queryByPlaceholderText("Type a message...")).toBeNull();
    });

    it("should show input field when appointment is not completed", async () => {
      mockGetMessages.mockResolvedValue({
        messages: [],
        conversation: {
          id: 1,
          conversationType: "appointment",
          appointment: {
            id: 100,
            completed: false,
            date: "2024-01-20",
          },
          participants: [{ userId: 1, user: { id: 1, username: "user1" } }],
        },
      });

      const { queryByText, getByPlaceholderText } = render(<ChatScreen />);

      await waitFor(() => {
        expect(mockGetMessages).toHaveBeenCalled();
      });

      // Should show the input field
      await waitFor(() => {
        expect(getByPlaceholderText("Type a message...")).toBeTruthy();
      });

      // Should NOT show the disabled message
      expect(
        queryByText("This appointment is complete, messaging for it is disabled.")
      ).toBeNull();
    });

    it("should show input field for support conversations", async () => {
      mockGetMessages.mockResolvedValue({
        messages: [],
        conversation: {
          id: 2,
          conversationType: "support",
          appointment: null,
          participants: [{ userId: 1, user: { id: 1, username: "user1" } }],
        },
      });

      const { queryByText, getByPlaceholderText } = render(<ChatScreen />);

      await waitFor(() => {
        expect(mockGetMessages).toHaveBeenCalled();
      });

      // Should show the input field
      await waitFor(() => {
        expect(getByPlaceholderText("Type a message...")).toBeTruthy();
      });

      // Should NOT show the disabled message
      expect(
        queryByText("This appointment is complete, messaging for it is disabled.")
      ).toBeNull();
    });

    it("should show input field for internal conversations", async () => {
      mockGetMessages.mockResolvedValue({
        messages: [],
        conversation: {
          id: 3,
          conversationType: "internal",
          appointment: null,
          participants: [
            { userId: 1, user: { id: 1, username: "owner1" } },
            { userId: 2, user: { id: 2, username: "hr1" } },
          ],
        },
      });

      const { queryByText, getByPlaceholderText } = render(<ChatScreen />);

      await waitFor(() => {
        expect(mockGetMessages).toHaveBeenCalled();
      });

      // Should show the input field
      await waitFor(() => {
        expect(getByPlaceholderText("Type a message...")).toBeTruthy();
      });

      // Should NOT show the disabled message
      expect(
        queryByText("This appointment is complete, messaging for it is disabled.")
      ).toBeNull();
    });

    it("should show input field for cleaner-client conversations", async () => {
      mockGetMessages.mockResolvedValue({
        messages: [],
        conversation: {
          id: 4,
          conversationType: "cleaner-client",
          appointment: null,
          participants: [
            { userId: 1, user: { id: 1, username: "cleaner1" } },
            { userId: 2, user: { id: 2, username: "client1" } },
          ],
        },
      });

      const { queryByText, getByPlaceholderText } = render(<ChatScreen />);

      await waitFor(() => {
        expect(mockGetMessages).toHaveBeenCalled();
      });

      // Should show the input field
      await waitFor(() => {
        expect(getByPlaceholderText("Type a message...")).toBeTruthy();
      });

      // Should NOT show the disabled message
      expect(
        queryByText("This appointment is complete, messaging for it is disabled.")
      ).toBeNull();
    });

    it("should show info icon with the disabled message", async () => {
      mockGetMessages.mockResolvedValue({
        messages: [],
        conversation: {
          id: 1,
          conversationType: "appointment",
          appointment: {
            id: 100,
            completed: true,
            date: "2024-01-15",
          },
          participants: [{ userId: 1, user: { id: 1, username: "user1" } }],
        },
      });

      const { getByText } = render(<ChatScreen />);

      await waitFor(() => {
        expect(mockGetMessages).toHaveBeenCalled();
      });

      // Should show the info icon (mocked as text "info")
      await waitFor(() => {
        expect(getByText("info")).toBeTruthy();
      });
    });

    it("should still display messages in a completed appointment conversation", async () => {
      mockGetMessages.mockResolvedValue({
        messages: [
          {
            id: 1,
            senderId: 2,
            content: "See you tomorrow!",
            createdAt: "2024-01-14T10:00:00Z",
            reactions: [],
            readReceipts: [],
          },
          {
            id: 2,
            senderId: 1,
            content: "Great, I will be ready!",
            createdAt: "2024-01-14T10:05:00Z",
            reactions: [],
            readReceipts: [],
          },
        ],
        conversation: {
          id: 1,
          conversationType: "appointment",
          appointment: {
            id: 100,
            completed: true,
            date: "2024-01-15",
          },
          participants: [
            { userId: 1, user: { id: 1, username: "user1" } },
            { userId: 2, user: { id: 2, username: "cleaner1" } },
          ],
        },
      });

      const { getByText } = render(<ChatScreen />);

      await waitFor(() => {
        expect(mockGetMessages).toHaveBeenCalled();
      });

      // Messages should still be visible
      await waitFor(() => {
        expect(getByText("See you tomorrow!")).toBeTruthy();
        expect(getByText("Great, I will be ready!")).toBeTruthy();
      });

      // But the disabled banner should also be shown
      expect(
        getByText("This appointment is complete, messaging for it is disabled.")
      ).toBeTruthy();
    });
  });

  describe("Broadcast Conversation Restriction", () => {
    it("should hide input for broadcast conversations when user is not owner", async () => {
      mockState = {
        currentUser: { token: "test-token", userId: "1" },
        account: null,
      };

      mockGetMessages.mockResolvedValue({
        messages: [],
        conversation: {
          id: 5,
          conversationType: "broadcast",
          title: "Company Announcement",
          appointment: null,
          participants: [{ userId: 1, user: { id: 1, username: "user1" } }],
        },
      });

      const { queryByPlaceholderText } = render(<ChatScreen />);

      await waitFor(() => {
        expect(mockGetMessages).toHaveBeenCalled();
      });

      // Should NOT show input field for non-owners
      await waitFor(
        () => {
          expect(queryByPlaceholderText("Type a message...")).toBeNull();
        },
        { timeout: 1000 }
      );
    });
  });
});
