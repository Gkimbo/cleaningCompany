import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const ClientCard = ({ client, onPress, onResendInvite, onDeleteInvitation, onBookCleaning, onSetupRecurring, onMessage, onPriceUpdate }) => {
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState(client.defaultPrice?.toString() || "");
  const isPending = client.status === "pending_invite";
  const isActive = client.status === "active";
  const isInactive = client.status === "inactive";

  const getStatusBadge = () => {
    if (isPending) {
      return {
        label: "Pending",
        bgColor: colors.warning[100],
        textColor: colors.warning[700],
        icon: "clock",
      };
    }
    if (isActive) {
      return {
        label: "Active",
        bgColor: colors.success[100],
        textColor: colors.success[700],
        icon: "check-circle",
      };
    }
    return {
      label: "Inactive",
      bgColor: colors.neutral[200],
      textColor: colors.neutral[600],
      icon: "x-circle",
    };
  };

  const status = getStatusBadge();

  const handlePriceEdit = (e) => {
    e.stopPropagation();
    setEditingPrice(true);
    setPriceInput(client.defaultPrice?.toString() || "");
  };

  const handlePriceSave = async (e) => {
    e.stopPropagation();
    if (!priceInput || isNaN(parseFloat(priceInput))) {
      Alert.alert("Error", "Please enter a valid price");
      return;
    }

    const newPrice = parseFloat(priceInput);
    setEditingPrice(false);

    if (onPriceUpdate) {
      const success = await onPriceUpdate(client.id, newPrice);
      if (!success) {
        // Revert if save failed
        setPriceInput(client.defaultPrice?.toString() || "");
      }
    }
  };

  const handlePriceCancel = (e) => {
    e.stopPropagation();
    setEditingPrice(false);
    setPriceInput(client.defaultPrice?.toString() || "");
  };

  const displayName = isActive && client.client
    ? `${client.client.firstName} ${client.client.lastName}`
    : client.invitedName;
  const displayEmail = isActive && client.client
    ? client.client.email
    : client.invitedEmail;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
      onPress={() => onPress(client)}
    >
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={[
            styles.avatar,
            isActive && styles.avatarActive,
            isPending && styles.avatarPending,
          ]}>
            <Feather
              name={isActive ? "user" : "user-plus"}
              size={20}
              color={isActive ? colors.primary[600] : colors.warning[600]}
            />
          </View>
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{displayEmail}</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
          <Feather name={status.icon} size={12} color={status.textColor} />
          <Text style={[styles.statusText, { color: status.textColor }]}>
            {status.label}
          </Text>
        </View>
      </View>

      {/* Home info if available */}
      {(client.home || client.invitedBeds) && (
        <View style={styles.homeInfo}>
          <Feather name="home" size={14} color={colors.neutral[400]} />
          <Text style={styles.homeText}>
            {client.home
              ? `${client.home.address}, ${client.home.city}`
              : client.invitedAddress?.address || "Address pending"}
          </Text>
          {(client.home?.numBeds || client.invitedBeds) && (
            <View style={styles.bedBathBadge}>
              <Text style={styles.bedBathText}>
                {client.home?.numBeds || client.invitedBeds}bd / {client.home?.numBaths || client.invitedBaths}ba
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Frequency, price, and cleaners info */}
      {(client.defaultFrequency || client.home?.cleanersNeeded > 1) && (
        <View style={styles.scheduleRow}>
          {client.defaultFrequency && (
            <View style={styles.scheduleItem}>
              <Feather name="calendar" size={14} color={colors.neutral[400]} />
              <Text style={styles.scheduleText}>
                {client.defaultFrequency === "weekly"
                  ? "Weekly"
                  : client.defaultFrequency === "biweekly"
                  ? "Every 2 weeks"
                  : client.defaultFrequency === "monthly"
                  ? "Monthly"
                  : "On demand"}
              </Text>
            </View>
          )}
          {(client.defaultPrice || onPriceUpdate) && (
            editingPrice ? (
              <View style={styles.priceEditContainer}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={styles.priceEditInput}
                  value={priceInput}
                  onChangeText={setPriceInput}
                  keyboardType="decimal-pad"
                  autoFocus
                  onBlur={handlePriceCancel}
                />
                <Pressable
                  style={styles.priceSaveBtn}
                  onPress={handlePriceSave}
                >
                  <Feather name="check" size={14} color={colors.neutral[0]} />
                </Pressable>
                <Pressable
                  style={styles.priceCancelBtn}
                  onPress={handlePriceCancel}
                >
                  <Feather name="x" size={14} color={colors.neutral[600]} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.priceDisplayItem,
                  onPriceUpdate && styles.priceEditable,
                  pressed && onPriceUpdate && styles.priceEditablePressed,
                ]}
                onPress={onPriceUpdate ? handlePriceEdit : undefined}
                disabled={!onPriceUpdate}
              >
                <Feather name="dollar-sign" size={14} color={colors.success[600]} />
                <Text style={styles.priceText}>
                  {client.defaultPrice ? parseFloat(client.defaultPrice).toFixed(0) : "Set price"}
                </Text>
                {onPriceUpdate && (
                  <Feather name="edit-2" size={12} color={colors.neutral[400]} />
                )}
              </Pressable>
            )
          )}
          {client.home?.cleanersNeeded > 1 && (
            <View style={styles.scheduleItem}>
              <Feather name="users" size={14} color={colors.neutral[400]} />
              <Text style={styles.scheduleText}>
                {client.home.cleanersNeeded} cleaners
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Active client actions */}
      {isActive && (onBookCleaning || onSetupRecurring || onMessage) && (
        <View style={styles.activeActions}>
          {onMessage && client.clientId && (
            <Pressable
              style={({ pressed }) => [
                styles.messageButton,
                pressed && styles.messageButtonPressed,
              ]}
              onPress={(e) => {
                e.stopPropagation();
                onMessage(client);
              }}
            >
              <Feather name="message-circle" size={14} color={colors.neutral[600]} />
            </Pressable>
          )}
          {onSetupRecurring && (
            <Pressable
              style={({ pressed }) => [
                styles.recurringButton,
                pressed && styles.recurringButtonPressed,
              ]}
              onPress={(e) => {
                e.stopPropagation();
                onSetupRecurring(client);
              }}
            >
              <Feather name="repeat" size={14} color={colors.primary[600]} />
              <Text style={styles.recurringButtonText}>Recurring</Text>
            </Pressable>
          )}
          {onBookCleaning && (
            <Pressable
              style={({ pressed }) => [
                styles.bookButton,
                pressed && styles.bookButtonPressed,
              ]}
              onPress={(e) => {
                e.stopPropagation();
                onBookCleaning(client);
              }}
            >
              <Feather name="calendar" size={14} color={colors.neutral[0]} />
              <Text style={styles.bookButtonText}>Book</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Pending invite actions */}
      {isPending && (
        <View style={styles.pendingActions}>
          <Text style={styles.pendingText}>
            Invited {new Date(client.invitedAt).toLocaleDateString()}
          </Text>
          <View style={styles.pendingButtonsRow}>
            {onDeleteInvitation && (
              <Pressable
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed && styles.deleteButtonPressed,
                ]}
                onPress={(e) => {
                  e.stopPropagation();
                  onDeleteInvitation(client);
                }}
              >
                <Feather name="trash-2" size={14} color={colors.error[600]} />
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [
                styles.resendButton,
                pressed && styles.resendButtonPressed,
              ]}
              onPress={(e) => {
                e.stopPropagation();
                onResendInvite(client);
              }}
            >
              <Feather name="send" size={14} color={colors.primary[600]} />
              <Text style={styles.resendButtonText}>Resend</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Chevron for navigation */}
      <View style={styles.chevron}>
        <Feather name="chevron-right" size={20} color={colors.neutral[400]} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
    position: "relative",
  },
  cardPressed: {
    backgroundColor: colors.neutral[50],
  },

  // Header row
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  avatarContainer: {
    marginRight: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarActive: {
    backgroundColor: colors.primary[50],
  },
  avatarPending: {
    backgroundColor: colors.warning[50],
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  email: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },

  // Status badge
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    gap: 4,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },

  // Home info
  homeInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    gap: spacing.sm,
  },
  homeText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  bedBathBadge: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.md,
  },
  bedBathText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },

  // Schedule row
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    gap: spacing.lg,
  },
  scheduleItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  scheduleText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },

  // Price editing
  priceDisplayItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  priceEditable: {
    backgroundColor: colors.success[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  priceEditablePressed: {
    backgroundColor: colors.success[100],
  },
  priceText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
    fontWeight: typography.fontWeight.semibold,
  },
  priceEditContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  dollarSign: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  priceEditInput: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[700],
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    minWidth: 60,
    textAlign: "right",
  },
  priceSaveBtn: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    backgroundColor: colors.success[600],
    alignItems: "center",
    justifyContent: "center",
  },
  priceCancelBtn: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    backgroundColor: colors.neutral[200],
    alignItems: "center",
    justifyContent: "center",
  },

  // Active client actions
  activeActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    gap: spacing.sm,
  },
  messageButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  messageButtonPressed: {
    backgroundColor: colors.neutral[200],
  },
  recurringButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  recurringButtonPressed: {
    backgroundColor: colors.primary[100],
  },
  recurringButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  bookButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary[600],
    borderRadius: radius.lg,
  },
  bookButtonPressed: {
    backgroundColor: colors.primary[700],
  },
  bookButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[0],
  },

  // Pending actions
  pendingActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  pendingText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[400],
  },
  pendingButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  deleteButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    backgroundColor: colors.error[50],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  deleteButtonPressed: {
    backgroundColor: colors.error[100],
  },
  resendButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
  },
  resendButtonPressed: {
    backgroundColor: colors.primary[100],
  },
  resendButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },

  // Chevron
  chevron: {
    position: "absolute",
    right: spacing.lg,
    top: "50%",
    marginTop: -10,
  },
});

export default ClientCard;
