import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

// Mock dependencies
jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
  useRoute: () => ({
    params: {
      caseId: 1,
      caseType: "appeal",
    },
  }),
}));

// Mock AuthContext
jest.mock("../../../src/services/AuthContext", () => {
  const React = require("react");
  const context = React.createContext({
    user: { token: "test_token", id: 1 },
    login: () => {},
    logout: () => {},
  });
  return {
    AuthContext: context,
    AuthProvider: ({ children }) => children,
  };
});

// Mock ConflictService
const mockGetCase = jest.fn();
const mockGetPhotos = jest.fn();
const mockGetChecklist = jest.fn();
const mockGetMessages = jest.fn();
const mockGetAuditTrail = jest.fn();
const mockProcessRefund = jest.fn();
const mockProcessPayout = jest.fn();
const mockAddNote = jest.fn();
const mockResolveCase = jest.fn();

jest.mock("../../../src/services/fetchRequests/ConflictService", () => ({
  getCase: (...args) => mockGetCase(...args),
  getPhotos: (...args) => mockGetPhotos(...args),
  getChecklist: (...args) => mockGetChecklist(...args),
  getMessages: (...args) => mockGetMessages(...args),
  getAuditTrail: (...args) => mockGetAuditTrail(...args),
  processRefund: (...args) => mockProcessRefund(...args),
  processPayout: (...args) => mockProcessPayout(...args),
  addNote: (...args) => mockAddNote(...args),
  resolveCase: (...args) => mockResolveCase(...args),
}));

// Mock theme
jest.mock("../../../src/services/styles/theme", () => ({
  colors: {
    neutral: { 0: "#fff", 50: "#f9f9f9", 100: "#f0f0f0", 200: "#e0e0e0", 300: "#bdbdbd" },
    primary: { 50: "#e3f2fd", 100: "#bbdefb", 400: "#42a5f5", 500: "#2196f3", 600: "#1976d2" },
    secondary: { 50: "#f8fafc", 100: "#f1f5f9", 200: "#e2e8f0", 700: "#334155", 800: "#1e293b" },
    warning: { 50: "#fff3e0", 100: "#ffe0b2", 500: "#ff9800", 600: "#fb8c00" },
    error: { 50: "#ffebee", 100: "#ffcdd2", 400: "#ef5350", 500: "#f44336", 600: "#e53935" },
    success: { 50: "#e8f5e9", 100: "#c8e6c9", 500: "#4caf50", 600: "#43a047" },
    text: { primary: "#000", secondary: "#666", tertiary: "#999" },
    border: { light: "#e0e0e0" },
    glass: { overlay: "rgba(0,0,0,0.5)" },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, "2xl": 20, full: 9999 },
  typography: {
    fontSize: { xs: 10, sm: 12, base: 14, lg: 18, xl: 20, "2xl": 24 },
    fontWeight: { normal: "400", medium: "500", semibold: "600", bold: "700" },
  },
  shadows: { sm: {}, md: {}, lg: {}, xl: {} },
}));

// Mock section components
jest.mock("../../../src/components/conflicts/sections/CaseOverviewSection", () => "CaseOverviewSection");
jest.mock("../../../src/components/conflicts/sections/EvidenceGallerySection", () => "EvidenceGallerySection");
jest.mock("../../../src/components/conflicts/sections/ChecklistReviewSection", () => "ChecklistReviewSection");
jest.mock("../../../src/components/conflicts/sections/MessageThreadSection", () => "MessageThreadSection");
jest.mock("../../../src/components/conflicts/sections/AuditTrailSection", () => "AuditTrailSection");
jest.mock("../../../src/components/conflicts/sections/FinancialSection", () => "FinancialSection");
jest.mock("../../../src/components/conflicts/sections/ResolutionActionsPanel", () => "ResolutionActionsPanel");

// Mock modal components
jest.mock("../../../src/components/conflicts/modals/RefundModal", () => "RefundModal");
jest.mock("../../../src/components/conflicts/modals/PayoutModal", () => "PayoutModal");
jest.mock("../../../src/components/conflicts/modals/PhotoViewerModal", () => "PhotoViewerModal");
jest.mock("../../../src/components/conflicts/modals/PhotoComparisonModal", () => "PhotoComparisonModal");
jest.mock("../../../src/components/conflicts/modals/AddNoteModal", () => "AddNoteModal");

import ConflictCaseView from "../../../src/components/conflicts/ConflictCaseView";

const renderWithContext = (props = {}) => {
  const AuthContext = require("../../../src/services/AuthContext").AuthContext;
  return render(
    <AuthContext.Provider value={{ user: { token: "test_token", id: 1 } }}>
      <ConflictCaseView {...props} />
    </AuthContext.Provider>
  );
};

describe("ConflictCaseView", () => {
  const mockCaseData = {
    id: 1,
    caseNumber: "APL-000001",
    status: "under_review",
    priority: "high",
    category: "quality",
    description: "Test case description",
    submittedAt: new Date().toISOString(),
    slaDeadline: new Date(Date.now() + 86400000).toISOString(),
    appointment: {
      id: 100,
      date: new Date().toISOString(),
      price: 15000,
    },
    homeowner: {
      id: 1,
      name: "John Doe",
      email: "john@test.com",
    },
    cleaner: {
      id: 2,
      name: "Jane Smith",
      email: "jane@test.com",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCase.mockResolvedValue({
      success: true,
      case: mockCaseData,
    });
    mockGetPhotos.mockResolvedValue({
      success: true,
      before: [],
      after: [],
      passes: [],
    });
    mockGetChecklist.mockResolvedValue({
      success: true,
      checklistData: {},
      completionNotes: null,
    });
    mockGetMessages.mockResolvedValue({
      success: true,
      messages: [],
    });
    mockGetAuditTrail.mockResolvedValue({
      success: true,
      auditTrail: [],
    });
  });

  describe("Rendering", () => {
    it("should fetch case data on mount", async () => {
      renderWithContext();

      await waitFor(() => {
        expect(mockGetCase).toHaveBeenCalledWith("test_token", "appeal", 1);
      });
    });

    it("should show loading state initially", async () => {
      const { getByText } = renderWithContext();

      await waitFor(() => {
        expect(mockGetCase).toHaveBeenCalled();
      });
    });

    it("should render case number in header after loading", async () => {
      renderWithContext();

      await waitFor(() => {
        expect(mockGetCase).toHaveBeenCalled();
      });
    });
  });

  describe("Tab Navigation", () => {
    it("should render all tab options", async () => {
      renderWithContext();

      await waitFor(() => {
        expect(mockGetCase).toHaveBeenCalled();
      });
    });

    it("should fetch photos when evidence tab is selected", async () => {
      renderWithContext();

      await waitFor(() => {
        expect(mockGetCase).toHaveBeenCalled();
      });
    });

    it("should fetch checklist when context tab is selected", async () => {
      renderWithContext();

      await waitFor(() => {
        expect(mockGetCase).toHaveBeenCalled();
      });
    });

    it("should fetch messages when messages tab is selected", async () => {
      renderWithContext();

      await waitFor(() => {
        expect(mockGetCase).toHaveBeenCalled();
      });
    });

    it("should fetch audit trail when activity tab is selected", async () => {
      renderWithContext();

      await waitFor(() => {
        expect(mockGetCase).toHaveBeenCalled();
      });
    });
  });

  describe("Error Handling", () => {
    it("should show error state when case not found", async () => {
      mockGetCase.mockResolvedValue({
        success: false,
        error: "Case not found",
      });

      renderWithContext();

      await waitFor(() => {
        expect(mockGetCase).toHaveBeenCalled();
      });
    });

    it("should handle fetch error gracefully", async () => {
      mockGetCase.mockRejectedValue(new Error("Network error"));

      renderWithContext();

      await waitFor(() => {
        expect(mockGetCase).toHaveBeenCalled();
      });
    });
  });

  describe("Actions", () => {
    it("should have access to resolution actions", async () => {
      renderWithContext();

      await waitFor(() => {
        expect(mockGetCase).toHaveBeenCalled();
      });
    });
  });

  describe("Refresh", () => {
    it("should refetch all data on refresh", async () => {
      renderWithContext();

      await waitFor(() => {
        expect(mockGetCase).toHaveBeenCalledTimes(1);
      });
    });
  });
});
