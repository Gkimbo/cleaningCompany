import React, { useState, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { WebView } from "react-native-webview";
import Markdown from "react-native-markdown-display";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import { API_BASE } from "../../services/config";

import useSafeNavigation from "../../hooks/useSafeNavigation";
const TermsEditor = ({ state }) => {
  const { goBack } = useSafeNavigation();
  const textInputRef = useRef(null);
  const [selectedType, setSelectedType] = useState("homeowner");
  const [contentType, setContentType] = useState("text");
  const [editorMode, setEditorMode] = useState("edit"); // "edit" or "preview"
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [currentTerms, setCurrentTerms] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    fetchHistory();
    fetchCurrentTerms();
  }, [selectedType]);

  const fetchCurrentTerms = async () => {
    try {
      const response = await fetch(`${API_BASE}/terms/current/${selectedType}`);
      const data = await response.json();
      setCurrentTerms(data.terms);
    } catch (err) {
      console.error("Error fetching current terms:", err);
    }
  };

  const loadTermsForEditing = async (termsId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/terms/${termsId}/full`, {
        headers: {
          Authorization: `Bearer ${state.currentUser.token}`,
        },
      });
      const data = await response.json();

      if (response.ok && data.terms) {
        const terms = data.terms;
        setTitle(terms.title);

        if (terms.contentType === "text") {
          setContentType("text");
          setContent(terms.content || "");
          setSelectedPdf(null);
          setEditorMode("edit");
        } else {
          setContentType("pdf");
          setContent("");
          // For PDF, we can't edit the file, but we show a message
          setError("PDF files cannot be edited directly. Upload a new PDF or switch to text content.");
        }

        setSuccess(`Loaded version ${terms.version}: "${terms.title}" - make your changes and publish as a new version.`);
      } else {
        setError(data.error || "Failed to load terms for editing");
      }
    } catch (err) {
      setError("Failed to load terms. Please try again.");
      console.error("Error loading terms:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadCurrent = () => {
    if (currentTerms) {
      loadTermsForEditing(currentTerms.id);
    }
  };

  const handleClearEditor = () => {
    setTitle("");
    setContent("");
    setSelectedPdf(null);
    setEditorMode("edit");
    setError(null);
    setSuccess(null);
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`${API_BASE}/terms/history/${selectedType}`, {
        headers: {
          Authorization: `Bearer ${state.currentUser.token}`,
        },
      });
      const data = await response.json();
      if (data.versions) {
        setHistory(data.versions);
      }
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Markdown formatting helpers
  const insertMarkdown = (prefix, suffix = "", placeholder = "") => {
    const { start, end } = selection;
    const selectedText = content.substring(start, end);
    const textToInsert = selectedText || placeholder;

    const newContent =
      content.substring(0, start) +
      prefix +
      textToInsert +
      suffix +
      content.substring(end);

    setContent(newContent);

    // Set cursor position after the inserted text
    const newPosition = start + prefix.length + textToInsert.length + suffix.length;
    setSelection({ start: newPosition, end: newPosition });
  };

  const insertAtLineStart = (prefix) => {
    const { start } = selection;
    // Find the start of the current line
    const lineStart = content.lastIndexOf("\n", start - 1) + 1;

    const newContent =
      content.substring(0, lineStart) +
      prefix +
      content.substring(lineStart);

    setContent(newContent);
  };

  const formatBold = () => insertMarkdown("**", "**", "bold text");
  const formatItalic = () => insertMarkdown("*", "*", "italic text");
  const formatHeading1 = () => insertAtLineStart("# ");
  const formatHeading2 = () => insertAtLineStart("## ");
  const formatHeading3 = () => insertAtLineStart("### ");
  const formatBulletList = () => insertAtLineStart("- ");
  const formatNumberedList = () => insertAtLineStart("1. ");
  const formatLink = () => insertMarkdown("[", "](url)", "link text");
  const formatQuote = () => insertAtLineStart("> ");
  const formatHorizontalRule = () => {
    const { start } = selection;
    const newContent =
      content.substring(0, start) +
      "\n\n---\n\n" +
      content.substring(start);
    setContent(newContent);
  };

  const handlePickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedPdf({
          uri: file.uri,
          name: file.name,
          size: file.size,
          mimeType: file.mimeType,
        });
        setError(null);
      }
    } catch (err) {
      setError("Failed to pick PDF file");
      console.error("Error picking PDF:", err);
    }
  };

  const handlePublish = async () => {
    if (!title.trim()) {
      setError("Please enter a title for the terms");
      return;
    }

    if (contentType === "text" && !content.trim()) {
      setError("Please enter the terms content");
      return;
    }

    if (contentType === "pdf" && !selectedPdf) {
      setError("Please select a PDF file");
      return;
    }

    const docTypeName = selectedType === "privacy_policy" ? "privacy policy" : `${selectedType} terms`;
    const affectedUsers = selectedType === "privacy_policy" ? "all users" : `all ${selectedType}s`;

    const confirmMessage = currentTerms
      ? `This will create version ${(currentTerms.version || 0) + 1} of the ${docTypeName}. ${affectedUsers.charAt(0).toUpperCase() + affectedUsers.slice(1)} will need to re-accept on their next login. Continue?`
      : `This will create the first version of the ${docTypeName}. Continue?`;

    if (Platform.OS === "web") {
      if (!window.confirm(confirmMessage)) return;
    } else {
      Alert.alert("Confirm Publish", confirmMessage, [
        { text: "Cancel", style: "cancel" },
        { text: "Publish", onPress: () => doPublish() },
      ]);
      return;
    }

    doPublish();
  };

  const doPublish = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let response;

      if (contentType === "text") {
        response = await fetch(`${API_BASE}/terms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${state.currentUser.token}`,
          },
          body: JSON.stringify({
            type: selectedType,
            title: title.trim(),
            content: content.trim(),
          }),
        });
      } else {
        // PDF upload
        const formData = new FormData();
        formData.append("type", selectedType);
        formData.append("title", title.trim());

        // Handle file for both web and native
        if (Platform.OS === "web") {
          const blob = await fetch(selectedPdf.uri).then((r) => r.blob());
          formData.append("pdf", blob, selectedPdf.name);
        } else {
          formData.append("pdf", {
            uri: selectedPdf.uri,
            name: selectedPdf.name,
            type: "application/pdf",
          });
        }

        response = await fetch(`${API_BASE}/terms/upload-pdf`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${state.currentUser.token}`,
          },
          body: formData,
        });
      }

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Terms version ${data.terms.version} published successfully!`);
        setTitle("");
        setContent("");
        setSelectedPdf(null);
        setEditorMode("edit");
        fetchHistory();
        fetchCurrentTerms();
      } else {
        setError(data.error || "Failed to publish terms");
      }
    } catch (err) {
      setError("Failed to publish terms. Please try again.");
      console.error("Error publishing terms:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Markdown preview styles
  const markdownStyles = {
    body: {
      color: colors.text.primary,
      fontSize: 16,
      lineHeight: 24,
    },
    heading1: {
      fontSize: 28,
      fontWeight: "bold",
      color: colors.text.primary,
      marginTop: 16,
      marginBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
      paddingBottom: 8,
    },
    heading2: {
      fontSize: 24,
      fontWeight: "bold",
      color: colors.text.primary,
      marginTop: 16,
      marginBottom: 8,
    },
    heading3: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.text.primary,
      marginTop: 12,
      marginBottom: 6,
    },
    paragraph: {
      marginBottom: 12,
    },
    listItem: {
      marginBottom: 4,
    },
    link: {
      color: colors.primary[600],
      textDecorationLine: "underline",
    },
    blockquote: {
      backgroundColor: colors.neutral[50],
      borderLeftWidth: 4,
      borderLeftColor: colors.primary[400],
      paddingLeft: 16,
      paddingVertical: 8,
      marginVertical: 8,
      fontStyle: "italic",
    },
    hr: {
      backgroundColor: colors.border.light,
      height: 1,
      marginVertical: 16,
    },
    strong: {
      fontWeight: "bold",
    },
    em: {
      fontStyle: "italic",
    },
    code_inline: {
      backgroundColor: colors.neutral[100],
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 14,
    },
  };

  const renderFormatToolbar = () => (
    <View style={styles.toolbar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarContent}>
        <Pressable style={styles.toolbarButton} onPress={formatBold}>
          <Text style={styles.toolbarButtonText}>B</Text>
        </Pressable>
        <Pressable style={styles.toolbarButton} onPress={formatItalic}>
          <Text style={[styles.toolbarButtonText, { fontStyle: "italic" }]}>I</Text>
        </Pressable>
        <View style={styles.toolbarDivider} />
        <Pressable style={styles.toolbarButton} onPress={formatHeading1}>
          <Text style={styles.toolbarButtonTextSmall}>H1</Text>
        </Pressable>
        <Pressable style={styles.toolbarButton} onPress={formatHeading2}>
          <Text style={styles.toolbarButtonTextSmall}>H2</Text>
        </Pressable>
        <Pressable style={styles.toolbarButton} onPress={formatHeading3}>
          <Text style={styles.toolbarButtonTextSmall}>H3</Text>
        </Pressable>
        <View style={styles.toolbarDivider} />
        <Pressable style={styles.toolbarButton} onPress={formatBulletList}>
          <Text style={styles.toolbarButtonTextSmall}>List</Text>
        </Pressable>
        <Pressable style={styles.toolbarButton} onPress={formatNumberedList}>
          <Text style={styles.toolbarButtonTextSmall}>1.</Text>
        </Pressable>
        <View style={styles.toolbarDivider} />
        <Pressable style={styles.toolbarButton} onPress={formatLink}>
          <Text style={styles.toolbarButtonTextSmall}>Link</Text>
        </Pressable>
        <Pressable style={styles.toolbarButton} onPress={formatQuote}>
          <Text style={styles.toolbarButtonTextSmall}>Quote</Text>
        </Pressable>
        <Pressable style={styles.toolbarButton} onPress={formatHorizontalRule}>
          <Text style={styles.toolbarButtonTextSmall}>---</Text>
        </Pressable>
      </ScrollView>
    </View>
  );

  const renderTextEditor = () => (
    <View style={styles.editorContainer}>
      {/* Edit/Preview Tabs */}
      <View style={styles.editorTabs}>
        <Pressable
          style={[styles.editorTab, editorMode === "edit" && styles.editorTabActive]}
          onPress={() => setEditorMode("edit")}
        >
          <Text style={[styles.editorTabText, editorMode === "edit" && styles.editorTabTextActive]}>
            Edit
          </Text>
        </Pressable>
        <Pressable
          style={[styles.editorTab, editorMode === "preview" && styles.editorTabActive]}
          onPress={() => setEditorMode("preview")}
        >
          <Text style={[styles.editorTabText, editorMode === "preview" && styles.editorTabTextActive]}>
            Preview
          </Text>
        </Pressable>
      </View>

      {editorMode === "edit" ? (
        <>
          {renderFormatToolbar()}
          <TextInput
            ref={textInputRef}
            style={styles.contentInput}
            placeholder="Write your terms and conditions here...&#10;&#10;Use markdown for formatting:&#10;# Heading 1&#10;## Heading 2&#10;**bold** and *italic*&#10;- bullet points&#10;1. numbered lists"
            value={content}
            onChangeText={setContent}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
            multiline
            textAlignVertical="top"
            placeholderTextColor={colors.text.tertiary}
          />
          <Text style={styles.markdownHint}>
            Tip: Use markdown formatting for rich text. Click Preview to see the result.
          </Text>
        </>
      ) : (
        <View style={styles.previewContainer}>
          {content.trim() ? (
            <ScrollView style={styles.previewScroll}>
              <Markdown style={markdownStyles}>{content}</Markdown>
            </ScrollView>
          ) : (
            <View style={styles.emptyPreview}>
              <Text style={styles.emptyPreviewText}>
                Nothing to preview yet. Switch to Edit mode and add some content.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );

  const renderPdfEditor = () => (
    <View style={styles.pdfEditorContainer}>
      {selectedPdf ? (
        <View style={styles.pdfPreviewContainer}>
          <View style={styles.pdfHeader}>
            <View style={styles.pdfInfo}>
              <View style={styles.pdfIconBadge}>
                <Text style={styles.pdfIconText}>PDF</Text>
              </View>
              <View style={styles.pdfDetails}>
                <Text style={styles.pdfName} numberOfLines={1}>
                  {selectedPdf.name}
                </Text>
                <Text style={styles.pdfSize}>
                  {formatFileSize(selectedPdf.size)}
                </Text>
              </View>
            </View>
            <Pressable
              style={styles.changePdfButton}
              onPress={() => setSelectedPdf(null)}
            >
              <Text style={styles.changePdfButtonText}>Change</Text>
            </Pressable>
          </View>

          {/* PDF Preview */}
          <View style={styles.pdfPreviewFrame}>
            <Text style={styles.pdfPreviewLabel}>Preview</Text>
            {Platform.OS === "web" ? (
              <iframe
                src={selectedPdf.uri}
                style={{ width: "100%", height: 400, border: "none", borderRadius: 8 }}
                title="PDF Preview"
              />
            ) : (
              <WebView
                source={{ uri: selectedPdf.uri }}
                style={styles.pdfWebView}
                startInLoadingState
                renderLoading={() => (
                  <View style={styles.pdfLoadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary[500]} />
                    <Text style={styles.pdfLoadingText}>Loading PDF...</Text>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      ) : (
        <Pressable style={styles.uploadButton} onPress={handlePickPdf}>
          <View style={styles.uploadIcon}>
            <Text style={styles.uploadIconText}>PDF</Text>
          </View>
          <Text style={styles.uploadTitle}>Choose PDF File</Text>
          <Text style={styles.uploadSubtitle}>
            Click to browse and select a PDF document
          </Text>
          <Text style={styles.uploadHint}>Maximum file size: 10MB</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {selectedType === "privacy_policy" ? "Privacy Policy" : "Terms & Conditions"}
        </Text>
      </View>

      {/* Current Version Badge */}
      {currentTerms && (
        <View style={styles.currentTermsBanner}>
          <View style={styles.currentTermsBadge}>
            <Text style={styles.currentTermsBadgeText}>CURRENT</Text>
          </View>
          <View style={styles.currentTermsContent}>
            <Text style={styles.currentTermsVersion}>Version {currentTerms.version}</Text>
            <Text style={styles.currentTermsTitle}>{currentTerms.title}</Text>
            <Text style={styles.currentTermsMeta}>
              {currentTerms.contentType === "pdf" ? "PDF Document" : "Text Content"} • {selectedType === "privacy_policy" ? "Privacy Policy" : selectedType}
            </Text>
          </View>
          <Pressable
            style={styles.editCurrentButton}
            onPress={handleLoadCurrent}
            disabled={loading}
          >
            <Text style={styles.editCurrentButtonText}>
              {loading ? "Loading..." : "Edit Current"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Document Type Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Document Type</Text>
        <View style={styles.segmentedControlThree}>
          <Pressable
            style={[
              styles.segmentButtonThree,
              selectedType === "homeowner" && styles.segmentButtonActive,
            ]}
            onPress={() => setSelectedType("homeowner")}
          >
            <Text
              style={[
                styles.segmentButtonText,
                selectedType === "homeowner" && styles.segmentButtonTextActive,
              ]}
            >
              Homeowner Terms
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.segmentButtonThree,
              selectedType === "cleaner" && styles.segmentButtonActive,
            ]}
            onPress={() => setSelectedType("cleaner")}
          >
            <Text
              style={[
                styles.segmentButtonText,
                selectedType === "cleaner" && styles.segmentButtonTextActive,
              ]}
            >
              Cleaner Terms
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.segmentButtonThree,
              selectedType === "privacy_policy" && styles.segmentButtonActive,
            ]}
            onPress={() => setSelectedType("privacy_policy")}
          >
            <Text
              style={[
                styles.segmentButtonText,
                selectedType === "privacy_policy" && styles.segmentButtonTextActive,
              ]}
            >
              Privacy Policy
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Title Input */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabelNoMargin}>Version Title</Text>
          {(title || content || selectedPdf) && (
            <Pressable style={styles.clearButton} onPress={handleClearEditor}>
              <Text style={styles.clearButtonText}>Clear Editor</Text>
            </Pressable>
          )}
        </View>
        <TextInput
          style={styles.titleInput}
          placeholder={selectedType === "privacy_policy" ? "e.g., Privacy Policy - January 2025" : "e.g., Terms of Service - January 2025"}
          value={title}
          onChangeText={setTitle}
          placeholderTextColor={colors.text.tertiary}
        />
      </View>

      {/* Content Type Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Content Type</Text>
        <View style={styles.contentTypeSelector}>
          <Pressable
            style={[
              styles.contentTypeOption,
              contentType === "text" && styles.contentTypeOptionActive,
            ]}
            onPress={() => {
              setContentType("text");
              setEditorMode("edit");
            }}
          >
            <View style={styles.contentTypeIcon}>
              <Text style={styles.contentTypeIconText}>Aa</Text>
            </View>
            <View style={styles.contentTypeInfo}>
              <Text
                style={[
                  styles.contentTypeTitle,
                  contentType === "text" && styles.contentTypeTitleActive,
                ]}
              >
                Rich Text
              </Text>
              <Text style={styles.contentTypeDesc}>
                Write with markdown formatting
              </Text>
            </View>
            {contentType === "text" && (
              <View style={styles.contentTypeCheck}>
                <Text style={styles.contentTypeCheckText}>✓</Text>
              </View>
            )}
          </Pressable>

          <Pressable
            style={[
              styles.contentTypeOption,
              contentType === "pdf" && styles.contentTypeOptionActive,
            ]}
            onPress={() => setContentType("pdf")}
          >
            <View style={[styles.contentTypeIcon, styles.contentTypeIconPdf]}>
              <Text style={styles.contentTypeIconText}>PDF</Text>
            </View>
            <View style={styles.contentTypeInfo}>
              <Text
                style={[
                  styles.contentTypeTitle,
                  contentType === "pdf" && styles.contentTypeTitleActive,
                ]}
              >
                PDF Upload
              </Text>
              <Text style={styles.contentTypeDesc}>
                Upload an existing document
              </Text>
            </View>
            {contentType === "pdf" && (
              <View style={styles.contentTypeCheck}>
                <Text style={styles.contentTypeCheckText}>✓</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Content Editor */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>
          {contentType === "text" ? "Terms Content" : "PDF Document"}
        </Text>
        {contentType === "text" ? renderTextEditor() : renderPdfEditor()}
      </View>

      {/* Error/Success Messages */}
      {error && (
        <View style={styles.messageError}>
          <Text style={styles.messageErrorText}>{error}</Text>
        </View>
      )}

      {success && (
        <View style={styles.messageSuccess}>
          <Text style={styles.messageSuccessText}>{success}</Text>
        </View>
      )}

      {/* Publish Button */}
      <Pressable
        style={[styles.publishButton, loading && styles.publishButtonDisabled]}
        onPress={handlePublish}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.neutral[0]} />
        ) : (
          <>
            <Text style={styles.publishButtonText}>Publish New Version</Text>
            <Text style={styles.publishButtonHint}>
              {currentTerms ? `Will create v${currentTerms.version + 1}` : "Will create v1"}
            </Text>
          </>
        )}
      </Pressable>

      {/* Version History */}
      <View style={styles.historySection}>
        <Text style={styles.historySectionTitle}>Version History</Text>
        {historyLoading ? (
          <View style={styles.historyLoading}>
            <ActivityIndicator size="small" color={colors.primary[500]} />
          </View>
        ) : history.length > 0 ? (
          <View style={styles.historyList}>
            {history.map((version, index) => (
              <View
                key={version.id}
                style={[
                  styles.historyItem,
                  index === 0 && styles.historyItemFirst
                ]}
              >
                <View style={styles.historyItemLeft}>
                  <View style={[
                    styles.historyVersionBadge,
                    index === 0 && styles.historyVersionBadgeCurrent
                  ]}>
                    <Text style={[
                      styles.historyVersionText,
                      index === 0 && styles.historyVersionTextCurrent
                    ]}>
                      v{version.version}
                    </Text>
                  </View>
                </View>
                <View style={styles.historyItemContent}>
                  <View style={styles.historyItemHeader}>
                    <Text style={styles.historyItemTitle}>{version.title}</Text>
                    <View style={styles.historyTypeBadge}>
                      <Text style={styles.historyTypeText}>
                        {version.contentType === "pdf" ? "PDF" : "Text"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.historyItemMeta}>
                    Published {formatDate(version.createdAt)}
                  </Text>
                  <View style={styles.historyItemActions}>
                    {version.contentType === "text" && (
                      <Pressable
                        style={styles.loadVersionButton}
                        onPress={() => loadTermsForEditing(version.id)}
                        disabled={loading}
                      >
                        <Text style={styles.loadVersionButtonText}>
                          {loading ? "..." : "Load & Edit"}
                        </Text>
                      </Pressable>
                    )}
                    {version.pdfUrl && Platform.OS === "web" && (
                      <Pressable
                        style={styles.viewPdfLink}
                        onPress={() => window.open(`${API_BASE}${version.pdfUrl}`, "_blank")}
                      >
                        <Text style={styles.viewPdfLinkText}>View PDF</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyHistory}>
            <Text style={styles.emptyHistoryText}>
              No {selectedType === "privacy_policy" ? "privacy policy" : "terms"} published yet{selectedType !== "privacy_policy" ? ` for ${selectedType}s` : ""}
            </Text>
            <Text style={styles.emptyHistoryHint}>
              Create your first version above
            </Text>
          </View>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  backButton: {
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
  },
  backButtonText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  currentTermsBanner: {
    flexDirection: "row",
    backgroundColor: colors.primary[50],
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
    alignItems: "center",
  },
  currentTermsBadge: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    marginRight: spacing.md,
  },
  currentTermsBadgeText: {
    color: colors.neutral[0],
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.5,
  },
  currentTermsContent: {
    flex: 1,
  },
  editCurrentButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginLeft: spacing.sm,
  },
  editCurrentButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  currentTermsVersion: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[800],
  },
  currentTermsTitle: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
  },
  currentTermsMeta: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[500],
    marginTop: 2,
  },
  section: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  sectionLabelNoMargin: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  clearButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.md,
  },
  clearButtonText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    padding: 4,
  },
  segmentedControlThree: {
    flexDirection: "row",
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    padding: 4,
    flexWrap: "wrap",
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: radius.md,
  },
  segmentButtonThree: {
    flex: 1,
    minWidth: 100,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: "center",
    borderRadius: radius.md,
  },
  segmentButtonActive: {
    backgroundColor: colors.neutral[0],
    ...shadows.sm,
  },
  segmentButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
    textAlign: "center",
  },
  segmentButtonTextActive: {
    color: colors.primary[600],
  },
  titleInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  contentTypeSelector: {
    gap: spacing.sm,
  },
  contentTypeOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border.light,
    backgroundColor: colors.background.secondary,
  },
  contentTypeOptionActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  contentTypeIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[200],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  contentTypeIconPdf: {
    backgroundColor: colors.error[100],
  },
  contentTypeIconText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary,
  },
  contentTypeInfo: {
    flex: 1,
  },
  contentTypeTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  contentTypeTitleActive: {
    color: colors.primary[700],
  },
  contentTypeDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  contentTypeCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary[500],
    alignItems: "center",
    justifyContent: "center",
  },
  contentTypeCheckText: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.bold,
  },
  editorContainer: {
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  editorTabs: {
    flexDirection: "row",
    backgroundColor: colors.neutral[100],
  },
  editorTab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  editorTabActive: {
    backgroundColor: colors.neutral[0],
    borderBottomColor: colors.primary[500],
  },
  editorTabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
  },
  editorTabTextActive: {
    color: colors.primary[600],
  },
  toolbar: {
    backgroundColor: colors.neutral[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  toolbarContent: {
    padding: spacing.sm,
    gap: spacing.xs,
    flexDirection: "row",
  },
  toolbarButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  toolbarButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  toolbarButtonTextSmall: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  toolbarDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border.light,
    marginHorizontal: spacing.xs,
    alignSelf: "center",
  },
  contentInput: {
    backgroundColor: colors.neutral[0],
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 300,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 22,
  },
  markdownHint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    padding: spacing.sm,
    backgroundColor: colors.neutral[50],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  previewContainer: {
    backgroundColor: colors.neutral[0],
    minHeight: 300,
  },
  previewScroll: {
    padding: spacing.lg,
    maxHeight: 400,
  },
  emptyPreview: {
    flex: 1,
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  emptyPreviewText: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    textAlign: "center",
  },
  pdfEditorContainer: {
    minHeight: 200,
  },
  uploadButton: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.primary[300],
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    backgroundColor: colors.primary[50],
  },
  uploadIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.error[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  uploadIconText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.error[600],
  },
  uploadTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
    marginBottom: spacing.xs,
  },
  uploadSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  uploadHint: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[400],
  },
  pdfPreviewContainer: {
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.success[300],
    backgroundColor: colors.success[50],
  },
  pdfHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    backgroundColor: colors.success[100],
    borderBottomWidth: 1,
    borderBottomColor: colors.success[200],
  },
  pdfInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  pdfIconBadge: {
    backgroundColor: colors.error[500],
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    marginRight: spacing.md,
  },
  pdfIconText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  pdfDetails: {
    flex: 1,
  },
  pdfName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  pdfSize: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  changePdfButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.md,
  },
  changePdfButtonText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  pdfPreviewFrame: {
    padding: spacing.md,
  },
  pdfPreviewLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[700],
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pdfWebView: {
    height: 400,
    borderRadius: radius.lg,
  },
  pdfLoadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral[100],
  },
  pdfLoadingText: {
    marginTop: spacing.sm,
    color: colors.text.tertiary,
  },
  messageError: {
    backgroundColor: colors.error[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  messageErrorText: {
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
  },
  messageSuccess: {
    backgroundColor: colors.success[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  messageSuccessText: {
    color: colors.success[700],
    fontSize: typography.fontSize.sm,
  },
  publishButton: {
    backgroundColor: colors.primary[600],
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.xl,
    ...shadows.lg,
  },
  publishButtonDisabled: {
    opacity: 0.6,
  },
  publishButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  publishButtonHint: {
    color: colors.primary[200],
    fontSize: typography.fontSize.sm,
    marginTop: 4,
  },
  historySection: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  historySectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  historyLoading: {
    padding: spacing.xl,
    alignItems: "center",
  },
  historyList: {
    gap: spacing.md,
  },
  historyItem: {
    flexDirection: "row",
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  historyItemFirst: {
    backgroundColor: colors.primary[50],
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderRadius: radius.lg,
    borderBottomWidth: 0,
  },
  historyItemLeft: {
    marginRight: spacing.md,
  },
  historyVersionBadge: {
    backgroundColor: colors.neutral[200],
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    minWidth: 40,
    alignItems: "center",
  },
  historyVersionBadgeCurrent: {
    backgroundColor: colors.primary[600],
  },
  historyVersionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary,
  },
  historyVersionTextCurrent: {
    color: colors.neutral[0],
  },
  historyItemContent: {
    flex: 1,
  },
  historyItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 2,
  },
  historyItemTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    flex: 1,
  },
  historyTypeBadge: {
    backgroundColor: colors.neutral[100],
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  historyTypeText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },
  historyItemMeta: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  historyItemActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
    flexWrap: "wrap",
  },
  loadVersionButton: {
    backgroundColor: colors.primary[100],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  loadVersionButtonText: {
    color: colors.primary[700],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  viewPdfLink: {
    paddingVertical: spacing.xs,
  },
  viewPdfLinkText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  emptyHistory: {
    alignItems: "center",
    padding: spacing.xl,
  },
  emptyHistoryText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  emptyHistoryHint: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
});

export default TermsEditor;
