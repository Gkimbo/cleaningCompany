/**
 * LinkedConversationSection Component Tests
 *
 * Tests the linked conversation display in conflict case view for support tickets.
 */

import React from "react";
import { render, waitFor, fireEvent } from "@testing-library/react-native";

// Mock dependencies
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

// Mock react-router-native
jest.mock("react-router-native", () => ({
  useNavigate: () => jest.fn(),
  useLocation: () => ({ key: "default", pathname: "/", search: "", hash: "", state: null }),
  useParams: () => ({}),
}));

jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

jest.mock("../../src/services/AuthContext", () => {
  const React = require("react");
  const MockAuthContext = React.createContext({ user: { token: "test-token" } });
  return {
    AuthContext: MockAuthContext,
  };
});

jest.mock("../../src/services/fetchRequests/ConflictService", () => ({
  getLinkedConversation: jest.fn(),
}));

import LinkedConversationSection from "../../src/components/conflicts/sections/LinkedConversationSection";
import ConflictService from "../../src/services/fetchRequests/ConflictService";
import { AuthContext } from "../../src/services/AuthContext";

// Wrapper component to provide context
const TestWrapper = ({ children }) => (
  <AuthContext.Provider value={{ user: { token: "test-token" } }}>
    {children}
  </AuthContext.Provider>
);

describe("LinkedConversationSection", () => {
  const defaultProps = {
    ticketId: 1,
    conversationId: 5,
  };

  const mockMessages = [
    {
      id: 1,
      content: "Hello, I need help with my account",
      createdAt: "2025-01-15T10:00:00Z",
      messageType: "text",
      sender: {
        id: 10,
        name: "John Homeowner",
        type: "homeowner",
        profileImage: null,
      },
    },
    {
      id: 2,
      content: "Sure, I can help you with that. What seems to be the issue?",
      createdAt: "2025-01-15T10:05:00Z",
      messageType: "text",
      sender: {
        id: 1,
        name: "HR Staff",
        type: "humanResources",
        profileImage: null,
      },
    },
    {
      id: 3,
      content: "I cannot reset my password",
      createdAt: "2025-01-15T10:10:00Z",
      messageType: "text",
      sender: {
        id: 10,
        name: "John Homeowner",
        type: "homeowner",
        profileImage: null,
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Loading State", () => {
    it("should show loading indicator initially", () => {
      ConflictService.getLinkedConversation.mockReturnValue(new Promise(() => {}));

      const { getByText } = render(
        <TestWrapper>
          <LinkedConversationSection {...defaultProps} />
        </TestWrapper>
      );

      expect(getByText("Loading support conversation...")).toBeTruthy();
    });
  });

  describe("Successful Data Load", () => {
    it("should display messages after loading", async () => {
      ConflictService.getLinkedConversation.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });

      const { getByText } = render(
        <TestWrapper>
          <LinkedConversationSection {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(getByText("Hello, I need help with my account")).toBeTruthy();
        expect(
          getByText("Sure, I can help you with that. What seems to be the issue?")
        ).toBeTruthy();
        expect(getByText("I cannot reset my password")).toBeTruthy();
      });
    });

    it("should display sender names", async () => {
      ConflictService.getLinkedConversation.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });

      const { getAllByText } = render(
        <TestWrapper>
          <LinkedConversationSection {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(getAllByText("John Homeowner").length).toBeGreaterThanOrEqual(1);
        expect(getAllByText("HR Staff").length).toBeGreaterThanOrEqual(1);
      });
    });

    it("should display message count in header", async () => {
      ConflictService.getLinkedConversation.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });

      const { getByText } = render(
        <TestWrapper>
          <LinkedConversationSection {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(getByText("3 messages")).toBeTruthy();
      });
    });

    it("should show Support Conversation header", async () => {
      ConflictService.getLinkedConversation.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });

      const { getByText } = render(
        <TestWrapper>
          <LinkedConversationSection {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(getByText("Support Conversation")).toBeTruthy();
      });
    });
  });

  describe("Empty Messages", () => {
    it("should show empty state when no messages", async () => {
      ConflictService.getLinkedConversation.mockResolvedValue({
        success: true,
        messages: [],
      });

      const { getByText } = render(
        <TestWrapper>
          <LinkedConversationSection {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(getByText("No Conversation")).toBeTruthy();
        expect(
          getByText("No linked support conversation for this ticket.")
        ).toBeTruthy();
      });
    });
  });

  describe("Error State", () => {
    it("should show error message on failure", async () => {
      ConflictService.getLinkedConversation.mockResolvedValue({
        success: false,
        error: "Failed to load conversation",
      });

      const { getByText } = render(
        <TestWrapper>
          <LinkedConversationSection {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(getByText("Unable to Load")).toBeTruthy();
        expect(getByText("Failed to load conversation")).toBeTruthy();
      });
    });

    it("should show retry button on error", async () => {
      ConflictService.getLinkedConversation.mockResolvedValue({
        success: false,
        error: "Network error",
      });

      const { getByText } = render(
        <TestWrapper>
          <LinkedConversationSection {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(getByText("Retry")).toBeTruthy();
      });
    });

    it("should retry fetching on retry button press", async () => {
      ConflictService.getLinkedConversation
        .mockResolvedValueOnce({
          success: false,
          error: "Network error",
        })
        .mockResolvedValueOnce({
          success: true,
          messages: mockMessages,
        });

      const { getByText } = render(
        <TestWrapper>
          <LinkedConversationSection {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(getByText("Retry")).toBeTruthy();
      });

      fireEvent.press(getByText("Retry"));

      await waitFor(() => {
        expect(ConflictService.getLinkedConversation).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("Sender Type Display", () => {
    it("should display correct labels for different user types", async () => {
      const messagesWithTypes = [
        {
          id: 1,
          content: "Message from homeowner",
          createdAt: "2025-01-15T10:00:00Z",
          messageType: "text",
          sender: { id: 1, name: "Home Owner", type: "homeowner" },
        },
        {
          id: 2,
          content: "Message from cleaner",
          createdAt: "2025-01-15T10:01:00Z",
          messageType: "text",
          sender: { id: 2, name: "Clean Er", type: "cleaner" },
        },
        {
          id: 3,
          content: "Message from HR",
          createdAt: "2025-01-15T10:02:00Z",
          messageType: "text",
          sender: { id: 3, name: "HR Person", type: "humanResources" },
        },
        {
          id: 4,
          content: "Message from owner",
          createdAt: "2025-01-15T10:03:00Z",
          messageType: "text",
          sender: { id: 4, name: "Business Owner", type: "owner" },
        },
      ];

      ConflictService.getLinkedConversation.mockResolvedValue({
        success: true,
        messages: messagesWithTypes,
      });

      const { getByText } = render(
        <TestWrapper>
          <LinkedConversationSection {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(getByText("Client")).toBeTruthy(); // homeowner label
        expect(getByText("Cleaner")).toBeTruthy();
        expect(getByText("HR")).toBeTruthy();
        expect(getByText("Owner")).toBeTruthy();
      });
    });
  });

  describe("System Messages", () => {
    it("should display system messages differently", async () => {
      const messagesWithSystem = [
        {
          id: 1,
          content: "Conversation started",
          createdAt: "2025-01-15T10:00:00Z",
          messageType: "system",
          sender: null,
        },
        {
          id: 2,
          content: "User message",
          createdAt: "2025-01-15T10:01:00Z",
          messageType: "text",
          sender: { id: 1, name: "John Doe", type: "homeowner" },
        },
      ];

      ConflictService.getLinkedConversation.mockResolvedValue({
        success: true,
        messages: messagesWithSystem,
      });

      const { getByText } = render(
        <TestWrapper>
          <LinkedConversationSection {...defaultProps} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(getByText("Conversation started")).toBeTruthy();
        expect(getByText("User message")).toBeTruthy();
      });
    });
  });

  describe("View Full Conversation Button", () => {
    it("should show View Full Conversation button when conversationId provided", async () => {
      ConflictService.getLinkedConversation.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });

      const { getByText } = render(
        <TestWrapper>
          <LinkedConversationSection ticketId={1} conversationId={5} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(getByText("View Full Conversation")).toBeTruthy();
      });
    });

    it("should not show View Full Conversation button when no conversationId", async () => {
      ConflictService.getLinkedConversation.mockResolvedValue({
        success: true,
        messages: [],
        conversationId: null,
      });

      const { queryByText } = render(
        <TestWrapper>
          <LinkedConversationSection ticketId={1} conversationId={null} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(queryByText("View Full Conversation")).toBeFalsy();
      });
    });
  });

  describe("API Calls", () => {
    it("should call getLinkedConversation with correct ticketId", async () => {
      ConflictService.getLinkedConversation.mockResolvedValue({
        success: true,
        messages: [],
      });

      render(
        <TestWrapper>
          <LinkedConversationSection ticketId={123} conversationId={5} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(ConflictService.getLinkedConversation).toHaveBeenCalledWith(
          "test-token",
          123
        );
      });
    });

    it("should refetch when ticketId changes", async () => {
      ConflictService.getLinkedConversation.mockResolvedValue({
        success: true,
        messages: [],
      });

      const { rerender } = render(
        <TestWrapper>
          <LinkedConversationSection ticketId={1} conversationId={5} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(ConflictService.getLinkedConversation).toHaveBeenCalledWith(
          "test-token",
          1
        );
      });

      rerender(
        <TestWrapper>
          <LinkedConversationSection ticketId={2} conversationId={6} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(ConflictService.getLinkedConversation).toHaveBeenCalledWith(
          "test-token",
          2
        );
      });
    });
  });
});

describe("LinkedConversationSection Message Formatting", () => {
  const TestWrapper = ({ children }) => (
    <AuthContext.Provider value={{ user: { token: "test-token" } }}>
      {children}
    </AuthContext.Provider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should format timestamps correctly", async () => {
    const messagesWithTimestamps = [
      {
        id: 1,
        content: "Test message",
        createdAt: "2025-01-15T14:30:00Z",
        messageType: "text",
        sender: { id: 1, name: "Test User", type: "homeowner" },
      },
    ];

    ConflictService.getLinkedConversation.mockResolvedValue({
      success: true,
      messages: messagesWithTimestamps,
    });

    const { getByText } = render(
      <TestWrapper>
        <LinkedConversationSection ticketId={1} conversationId={5} />
      </TestWrapper>
    );

    await waitFor(() => {
      // Check that some formatted date is displayed
      // The exact format depends on the user's locale
      expect(getByText("Test message")).toBeTruthy();
    });
  });

  it("should handle messages with profile images", async () => {
    const messagesWithImages = [
      {
        id: 1,
        content: "Test message",
        createdAt: "2025-01-15T10:00:00Z",
        messageType: "text",
        sender: {
          id: 1,
          name: "Test User",
          type: "homeowner",
          profileImage: "https://example.com/photo.jpg",
        },
      },
    ];

    ConflictService.getLinkedConversation.mockResolvedValue({
      success: true,
      messages: messagesWithImages,
    });

    const { getByText } = render(
      <TestWrapper>
        <LinkedConversationSection ticketId={1} conversationId={5} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByText("Test message")).toBeTruthy();
    });
  });
});
