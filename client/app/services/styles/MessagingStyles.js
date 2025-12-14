import { StyleSheet } from "react-native";
import { colors, spacing, radius, shadows, typography, screen, responsive } from "./theme";

const messagingStyles = StyleSheet.create({
  // Main container
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    ...shadows.sm,
  },

  headerTitle: {
    fontSize: responsive(typography.fontSize.lg, typography.fontSize.xl, typography.fontSize["2xl"]),
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },

  // Conversation list
  conversationList: {
    flex: 1,
    paddingTop: spacing.sm,
  },

  // Conversation item (tile)
  conversationItem: {
    flexDirection: "row",
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.light,
    ...shadows.sm,
  },

  conversationItemUnread: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },

  conversationItemBroadcast: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning[500],
  },

  conversationContent: {
    flex: 1,
    marginRight: spacing.md,
  },

  conversationTitle: {
    fontSize: responsive(typography.fontSize.sm, typography.fontSize.base, typography.fontSize.base),
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },

  conversationPreview: {
    fontSize: responsive(typography.fontSize.xs, typography.fontSize.sm, typography.fontSize.sm),
    color: colors.text.secondary,
  },

  conversationTime: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },

  // Unread badge
  unreadBadge: {
    backgroundColor: colors.error[500],
    borderRadius: radius.full,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },

  unreadBadgeText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  // Avatar/Icon
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },

  avatarText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },

  // Chat screen
  chatContainer: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },

  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    ...shadows.sm,
  },

  chatHeaderTitle: {
    flex: 1,
    fontSize: responsive(typography.fontSize.base, typography.fontSize.lg, typography.fontSize.lg),
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginLeft: spacing.md,
  },

  // Messages list
  messagesList: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  // Message bubble
  messageBubble: {
    maxWidth: "80%",
    padding: spacing.md,
    borderRadius: radius.xl,
    marginVertical: spacing.xs,
  },

  messageBubbleSent: {
    backgroundColor: colors.primary[600],
    alignSelf: "flex-end",
    borderBottomRightRadius: radius.sm,
  },

  messageBubbleReceived: {
    backgroundColor: colors.neutral[0],
    alignSelf: "flex-start",
    borderBottomLeftRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },

  messageBubbleBroadcast: {
    backgroundColor: colors.warning[50],
    alignSelf: "center",
    maxWidth: "90%",
    borderColor: colors.warning[300],
    borderWidth: 1,
    borderRadius: radius.lg,
  },

  messageText: {
    fontSize: typography.fontSize.base,
    lineHeight: 22,
  },

  messageTextSent: {
    color: colors.neutral[0],
  },

  messageTextReceived: {
    color: colors.text.primary,
  },

  messageSender: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
    color: colors.text.secondary,
  },

  messageTime: {
    fontSize: 10,
    marginTop: spacing.xs,
    alignSelf: "flex-end",
  },

  messageTimeSent: {
    color: "rgba(255, 255, 255, 0.7)",
  },

  messageTimeReceived: {
    color: colors.text.tertiary,
  },

  // Input area
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral[0],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },

  inputField: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },

  sendButton: {
    marginLeft: spacing.sm,
    backgroundColor: colors.primary[600],
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.sm,
  },

  sendButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },

  sendButtonText: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },

  // Broadcast form
  broadcastContainer: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.background.secondary,
  },

  broadcastTitle: {
    fontSize: responsive(typography.fontSize.lg, typography.fontSize.xl, typography.fontSize["2xl"]),
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xl,
    textAlign: "center",
  },

  broadcastLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },

  broadcastInput: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },

  broadcastTextArea: {
    minHeight: 120,
    textAlignVertical: "top",
  },

  // Audience selector
  audienceContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.sm,
    gap: spacing.sm,
  },

  audienceOption: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.neutral[0],
    borderWidth: 1.5,
    borderColor: colors.border.default,
  },

  audienceOptionSelected: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },

  audienceOptionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },

  audienceOptionTextSelected: {
    color: colors.neutral[0],
  },

  // Broadcast button
  broadcastButton: {
    backgroundColor: colors.warning[500],
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    marginTop: spacing.xl,
    alignItems: "center",
    ...shadows.md,
  },

  broadcastButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing["3xl"],
  },

  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    textAlign: "center",
    marginTop: spacing.lg,
  },

  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Navigation button with badge
  messagesButtonContainer: {
    position: "relative",
  },

  messagesButton: {
    padding: spacing.sm,
  },

  navBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: colors.error[500],
    borderRadius: radius.full,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xs,
  },

  navBadgeText: {
    color: colors.neutral[0],
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
  },

  // Participants list
  participantsContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.neutral[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  participantsText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },

  // Date separator
  dateSeparator: {
    alignSelf: "center",
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginVertical: spacing.md,
  },

  dateSeparatorText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },

  // Back button for chat
  backButton: {
    padding: spacing.sm,
  },
});

export default messagingStyles;
