import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";
import TermsEditor from "../../src/components/owner/TermsEditor";

// Mock react-router-native
const mockNavigate = jest.fn();
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
}));

// Mock the API_BASE
jest.mock("../../src/services/config", () => ({
  API_BASE: "http://localhost:5000/api/v1",
}));

// Mock expo-document-picker
jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(),
}));

// Mock WebView
jest.mock("react-native-webview", () => ({
  WebView: "WebView",
}));

// Mock react-native-markdown-display
jest.mock("react-native-markdown-display", () => "Markdown");

// Mock fetch
global.fetch = jest.fn();

// Mock window.confirm for web platform tests
global.confirm = jest.fn(() => true);

import * as DocumentPicker from "expo-document-picker";

describe("TermsEditor", () => {
  const defaultState = {
    currentUser: {
      token: "owner-token-123",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockReset();

    // Default mock implementations
    global.fetch.mockImplementation((url) => {
      if (url.includes("/current/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ terms: null }),
        });
      }
      if (url.includes("/history/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ versions: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });
  });

  describe("Rendering", () => {
    it("should render the terms editor header", async () => {
      const { getByText } = render(<TermsEditor state={defaultState} />);

      expect(getByText("Terms & Conditions")).toBeTruthy();
    });

    it("should render document type selector", async () => {
      const { getByText } = render(<TermsEditor state={defaultState} />);

      expect(getByText("Homeowner Terms")).toBeTruthy();
      expect(getByText("Cleaner Terms")).toBeTruthy();
      expect(getByText("Privacy Policy")).toBeTruthy();
    });

    it("should render content type options", async () => {
      const { getByText } = render(<TermsEditor state={defaultState} />);

      expect(getByText("Rich Text")).toBeTruthy();
      expect(getByText("PDF Upload")).toBeTruthy();
    });

    it("should render publish button", async () => {
      const { getByText } = render(<TermsEditor state={defaultState} />);

      expect(getByText("Publish New Version")).toBeTruthy();
    });

    it("should render version history section", async () => {
      const { getByText } = render(<TermsEditor state={defaultState} />);

      expect(getByText("Version History")).toBeTruthy();
    });

    it("should show empty history message when no versions exist", async () => {
      const { getByText } = render(<TermsEditor state={defaultState} />);

      await waitFor(() => {
        expect(getByText(/No terms published yet/)).toBeTruthy();
      });
    });
  });

  describe("User Type Selection", () => {
    it("should default to homeowner type", async () => {
      global.fetch.mockImplementation((url) => {
        if (url.includes("/current/homeowner")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ terms: null }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ versions: [] }),
        });
      });

      render(<TermsEditor state={defaultState} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/current/homeowner")
        );
      });
    });

    it("should switch to cleaner type when selected", async () => {
      const { getByText } = render(<TermsEditor state={defaultState} />);

      const cleanerButton = getByText("Cleaner Terms");
      fireEvent.press(cleanerButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/current/cleaner")
        );
      });
    });
  });

  describe("Content Type Selection", () => {
    it("should show text editor by default", async () => {
      const { getByText } = render(<TermsEditor state={defaultState} />);

      expect(getByText("Edit")).toBeTruthy();
      expect(getByText("Preview")).toBeTruthy();
    });

    it("should switch to PDF upload when PDF type selected", async () => {
      const { getByText } = render(<TermsEditor state={defaultState} />);

      const pdfOption = getByText("PDF Upload");
      fireEvent.press(pdfOption);

      expect(getByText("Choose PDF File")).toBeTruthy();
    });
  });

  describe("Text Editor", () => {
    it("should render formatting toolbar", async () => {
      const { getByText } = render(<TermsEditor state={defaultState} />);

      expect(getByText("B")).toBeTruthy(); // Bold
      expect(getByText("H1")).toBeTruthy(); // Heading 1
      expect(getByText("H2")).toBeTruthy(); // Heading 2
      expect(getByText("List")).toBeTruthy(); // Bullet list
      expect(getByText("Link")).toBeTruthy(); // Link
    });

    it("should switch between edit and preview modes", async () => {
      const { getByText } = render(<TermsEditor state={defaultState} />);

      const previewTab = getByText("Preview");
      fireEvent.press(previewTab);

      // Should show empty preview message
      expect(getByText(/Nothing to preview yet/)).toBeTruthy();

      const editTab = getByText("Edit");
      fireEvent.press(editTab);

      // Should be back in edit mode
      expect(getByText("B")).toBeTruthy();
    });
  });

  describe("PDF Upload", () => {
    it("should open document picker when upload button pressed", async () => {
      DocumentPicker.getDocumentAsync.mockResolvedValueOnce({
        canceled: true,
      });

      const { getByText } = render(<TermsEditor state={defaultState} />);

      const pdfOption = getByText("PDF Upload");
      fireEvent.press(pdfOption);

      const uploadButton = getByText("Choose PDF File");
      fireEvent.press(uploadButton);

      expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledWith({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
    });

    it("should display selected PDF info", async () => {
      DocumentPicker.getDocumentAsync.mockResolvedValueOnce({
        canceled: false,
        assets: [
          {
            uri: "file:///test/terms.pdf",
            name: "terms.pdf",
            size: 1024000,
            mimeType: "application/pdf",
          },
        ],
      });

      const { getByText } = render(<TermsEditor state={defaultState} />);

      const pdfOption = getByText("PDF Upload");
      fireEvent.press(pdfOption);

      const uploadButton = getByText("Choose PDF File");
      fireEvent.press(uploadButton);

      await waitFor(() => {
        expect(getByText("terms.pdf")).toBeTruthy();
        expect(getByText("1000.0 KB")).toBeTruthy();
      });
    });

    it("should allow changing selected PDF", async () => {
      DocumentPicker.getDocumentAsync.mockResolvedValueOnce({
        canceled: false,
        assets: [
          {
            uri: "file:///test/terms.pdf",
            name: "terms.pdf",
            size: 1024,
            mimeType: "application/pdf",
          },
        ],
      });

      const { getByText } = render(<TermsEditor state={defaultState} />);

      const pdfOption = getByText("PDF Upload");
      fireEvent.press(pdfOption);

      const uploadButton = getByText("Choose PDF File");
      fireEvent.press(uploadButton);

      await waitFor(() => {
        expect(getByText("terms.pdf")).toBeTruthy();
      });

      const changeButton = getByText("Change");
      fireEvent.press(changeButton);

      expect(getByText("Choose PDF File")).toBeTruthy();
    });
  });

  describe("Publishing Terms", () => {
    it("should show error if title is empty", async () => {
      const { getByText } = render(<TermsEditor state={defaultState} />);

      const publishButton = getByText("Publish New Version");
      fireEvent.press(publishButton);

      await waitFor(() => {
        expect(getByText("Please enter a title for the terms")).toBeTruthy();
      });
    });

    it("should show error if content is empty for text type", async () => {
      const { getByText, getByPlaceholderText } = render(
        <TermsEditor state={defaultState} />
      );

      const titleInput = getByPlaceholderText(/Terms of Service/);
      fireEvent.changeText(titleInput, "My Terms");

      const publishButton = getByText("Publish New Version");
      fireEvent.press(publishButton);

      await waitFor(() => {
        expect(getByText("Please enter the terms content")).toBeTruthy();
      });
    });

    it("should show error if no PDF selected for PDF type", async () => {
      const { getByText, getByPlaceholderText } = render(
        <TermsEditor state={defaultState} />
      );

      // Select PDF type
      const pdfOption = getByText("PDF Upload");
      fireEvent.press(pdfOption);

      // Enter title
      const titleInput = getByPlaceholderText(/Terms of Service/);
      fireEvent.changeText(titleInput, "My Terms");

      const publishButton = getByText("Publish New Version");
      fireEvent.press(publishButton);

      await waitFor(() => {
        expect(getByText("Please select a PDF file")).toBeTruthy();
      });
    });

    it("should publish text terms successfully", async () => {
      // Mock Alert.alert to auto-press the Publish button
      jest.spyOn(Alert, "alert").mockImplementation((title, message, buttons) => {
        const publishBtn = buttons?.find((b) => b.text === "Publish");
        if (publishBtn?.onPress) {
          publishBtn.onPress();
        }
      });

      global.fetch.mockImplementation((url, options) => {
        if (url.includes("/current/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ terms: null }),
          });
        }
        if (url.includes("/history/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ versions: [] }),
          });
        }
        if (options?.method === "POST") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              terms: { version: 1 },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });

      const { getByText, getByPlaceholderText } = render(
        <TermsEditor state={defaultState} />
      );

      // Enter title
      const titleInput = getByPlaceholderText(/Terms of Service/);
      fireEvent.changeText(titleInput, "My Terms");

      // Enter content
      const contentInput = getByPlaceholderText(/Write your terms/);
      fireEvent.changeText(contentInput, "These are my terms and conditions.");

      // Publish
      const publishButton = getByText("Publish New Version");
      fireEvent.press(publishButton);

      await waitFor(() => {
        expect(getByText(/published successfully/)).toBeTruthy();
      });
    });
  });

  describe("Current Version Display", () => {
    it("should display current version banner when terms exist", async () => {
      global.fetch.mockImplementation((url) => {
        if (url.includes("/current/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              terms: {
                id: 1,
                version: 2,
                title: "Terms v2",
                contentType: "text",
              },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ versions: [] }),
        });
      });

      const { getByText } = render(<TermsEditor state={defaultState} />);

      await waitFor(() => {
        expect(getByText("CURRENT")).toBeTruthy();
        expect(getByText("Version 2")).toBeTruthy();
        expect(getByText("Terms v2")).toBeTruthy();
      });
    });

    it("should show next version number on publish button", async () => {
      global.fetch.mockImplementation((url) => {
        if (url.includes("/current/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              terms: {
                id: 1,
                version: 3,
                title: "Terms v3",
                contentType: "text",
              },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ versions: [] }),
        });
      });

      const { getByText } = render(<TermsEditor state={defaultState} />);

      await waitFor(() => {
        expect(getByText("Will create v4")).toBeTruthy();
      });
    });
  });

  describe("Version History", () => {
    it("should display version history", async () => {
      global.fetch.mockImplementation((url) => {
        if (url.includes("/current/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ terms: null }),
          });
        }
        if (url.includes("/history/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              versions: [
                {
                  id: 2,
                  version: 2,
                  title: "Terms v2",
                  contentType: "text",
                  createdAt: "2025-01-15T00:00:00.000Z",
                  createdBy: "Admin User",
                },
                {
                  id: 1,
                  version: 1,
                  title: "Terms v1",
                  contentType: "pdf",
                  createdAt: "2025-01-01T00:00:00.000Z",
                  createdBy: "Admin User",
                  pdfUrl: "/api/v1/terms/pdf/1",
                },
              ],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });

      const { getByText } = render(<TermsEditor state={defaultState} />);

      await waitFor(() => {
        expect(getByText("v2")).toBeTruthy();
        expect(getByText("v1")).toBeTruthy();
        expect(getByText("Terms v2")).toBeTruthy();
        expect(getByText("Terms v1")).toBeTruthy();
      });
    });
  });

  describe("Navigation", () => {
    it("should navigate back when back button pressed", async () => {
      const { getByText } = render(<TermsEditor state={defaultState} />);

      const backButton = getByText("Back");
      fireEvent.press(backButton);

      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });

  describe("Privacy Policy Support", () => {
    it("should switch to privacy policy when selected", async () => {
      const { getByText } = render(<TermsEditor state={defaultState} />);

      const privacyButton = getByText("Privacy Policy");
      fireEvent.press(privacyButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/current/privacy_policy")
        );
      });
    });

    it("should show privacy policy empty message", async () => {
      global.fetch.mockImplementation((url) => {
        if (url.includes("/current/privacy_policy")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ terms: null }),
          });
        }
        if (url.includes("/history/privacy_policy")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ versions: [] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });

      const { getByText } = render(<TermsEditor state={defaultState} />);

      fireEvent.press(getByText("Privacy Policy"));

      await waitFor(() => {
        expect(getByText(/No privacy policy published yet/)).toBeTruthy();
      });
    });

    it("should use privacy policy placeholder for title", async () => {
      global.fetch.mockImplementation((url) => {
        if (url.includes("/current/privacy_policy")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ terms: null }),
          });
        }
        if (url.includes("/history/privacy_policy")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ versions: [] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });

      const { getByText, getByPlaceholderText } = render(<TermsEditor state={defaultState} />);

      fireEvent.press(getByText("Privacy Policy"));

      await waitFor(() => {
        expect(getByPlaceholderText(/Privacy Policy - January/)).toBeTruthy();
      });
    });
  });

  describe("Edit Current Feature", () => {
    it("should show Edit Current button when terms exist", async () => {
      global.fetch.mockImplementation((url) => {
        if (url.includes("/current/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              terms: {
                id: 1,
                version: 1,
                title: "Terms v1",
                contentType: "text",
              },
            }),
          });
        }
        if (url.includes("/history/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ versions: [] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });

      const { getByText } = render(<TermsEditor state={defaultState} />);

      await waitFor(() => {
        expect(getByText("Edit Current")).toBeTruthy();
      });
    });

    it("should load terms for editing on Edit Current press", async () => {
      global.fetch.mockImplementation((url) => {
        if (url.includes("/current/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              terms: {
                id: 1,
                version: 1,
                title: "Terms v1",
                contentType: "text",
              },
            }),
          });
        }
        if (url.includes("/history/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ versions: [] }),
          });
        }
        if (url.includes("/terms/1/full")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              terms: {
                id: 1,
                version: 1,
                title: "Terms v1",
                content: "Full terms content for editing",
                contentType: "text",
                createdBy: "Admin User",
              },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });

      const { getByText } = render(<TermsEditor state={defaultState} />);

      await waitFor(() => {
        expect(getByText("Edit Current")).toBeTruthy();
      });

      fireEvent.press(getByText("Edit Current"));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/terms/1/full"),
          expect.any(Object)
        );
      });
    });

    it("should show success message after loading terms", async () => {
      global.fetch.mockImplementation((url) => {
        if (url.includes("/current/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              terms: {
                id: 1,
                version: 1,
                title: "Terms v1",
                contentType: "text",
              },
            }),
          });
        }
        if (url.includes("/history/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ versions: [] }),
          });
        }
        if (url.includes("/terms/1/full")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              terms: {
                id: 1,
                version: 1,
                title: "Terms v1",
                content: "Content",
                contentType: "text",
                createdBy: "Admin",
              },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });

      const { getByText } = render(<TermsEditor state={defaultState} />);

      await waitFor(() => {
        expect(getByText("Edit Current")).toBeTruthy();
      });

      fireEvent.press(getByText("Edit Current"));

      await waitFor(() => {
        expect(getByText(/Loaded version 1/)).toBeTruthy();
      });
    });
  });

  describe("Load from Version History", () => {
    it("should show Load & Edit button for text versions in history", async () => {
      global.fetch.mockImplementation((url) => {
        if (url.includes("/current/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              terms: {
                id: 2,
                version: 2,
                title: "Terms v2",
                contentType: "text",
              },
            }),
          });
        }
        if (url.includes("/history/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              versions: [
                {
                  id: 2,
                  version: 2,
                  title: "Terms v2",
                  contentType: "text",
                  createdAt: "2025-01-01T00:00:00Z",
                },
                {
                  id: 1,
                  version: 1,
                  title: "Terms v1",
                  contentType: "text",
                  createdAt: "2024-12-01T00:00:00Z",
                },
              ],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });

      const { getAllByText } = render(<TermsEditor state={defaultState} />);

      await waitFor(() => {
        const loadButtons = getAllByText("Load & Edit");
        expect(loadButtons.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Clear Editor", () => {
    it("should not show Clear Editor button when editor is empty", async () => {
      const { queryByText } = render(<TermsEditor state={defaultState} />);

      expect(queryByText("Clear Editor")).toBeNull();
    });
  });
});
