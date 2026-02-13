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

const ClientCard = ({ client, onPress, onResendInvite, onDeleteInvitation, onBookCleaning, onSetupRecurring, onMessage, onPriceUpdate, platformPrice }) => {
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState(client.defaultPrice?.toString() || "");
  const isPending = client.status === "pending_invite";
  const isActive = client.status === "active";
  const isInactive = client.status === "inactive";

  const getStatusConfig = () => {
    if (isPending) {
      return {
        label: "Pending",
        bgColor: colors.warning[50],
        textColor: colors.warning[700],
        borderColor: colors.warning[200],
        icon: "clock",
      };
    }
    if (isActive) {
      return {
        label: "Active",
        bgColor: colors.success[50],
        textColor: colors.success[700],
        borderColor: colors.success[200],
        icon: "check-circle",
      };
    }
    return {
      label: "Inactive",
      bgColor: colors.neutral[100],
      textColor: colors.neutral[500],
      borderColor: colors.neutral[200],
      icon: "x-circle",
    };
  };

  const status = getStatusConfig();

  const handlePriceEdit = (e) => {
    e.stopPropagation();
    setEditingPrice(true);
    setPriceInput(client.defaultPrice?.toString() || "");
  };

  const savePrice = async (newPrice) => {
    setEditingPrice(false);
    if (onPriceUpdate) {
      const success = await onPriceUpdate(client.id, newPrice);
      if (!success) {
        setPriceInput(client.defaultPrice?.toString() || "");
      }
    }
  };

  const handlePriceSave = async (e) => {
    e.stopPropagation();
    if (!priceInput || isNaN(parseFloat(priceInput))) {
      Alert.alert("Error", "Please enter a valid price");
      return;
    }

    const newPrice = parseFloat(priceInput);
    const oldPrice = client.defaultPrice;

    if (isActive && newPrice !== oldPrice) {
      Alert.alert(
        "Change Price?",
        "Are you sure you'd like to change the price to clean this home? The client will be notified.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Yes, Change Price",
            onPress: () => savePrice(newPrice),
          },
        ]
      );
    } else {
      savePrice(newPrice);
    }
  };

  const handlePriceCancel = (e) => {
    e.stopPropagation();
    setEditingPrice(false);
    setPriceInput(client.defaultPrice?.toString() || "");
  };

  const handleUsePlatformPrice = (e) => {
    e.stopPropagation();
    if (platformPrice) {
      setPriceInput(platformPrice.toString());
    }
  };

  const displayName = isActive && client.client
    ? `${client.client.firstName} ${client.client.lastName}`
    : client.invitedName;
  const displayEmail = isActive && client.client
    ? client.client.email
    : client.invitedEmail;

  // Get initials for avatar
  const getInitials = () => {
    if (!displayName) return "?";
    const parts = displayName.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return displayName[0]?.toUpperCase() || "?";
  };

  const homeCount = client.homes?.length || (client.home ? 1 : 0);
  const primaryHome = client.homes?.[0] || client.home;
  const beds = primaryHome?.numBeds || client.invitedBeds;
  const baths = primaryHome?.numBaths || client.invitedBaths;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
        isPending && styles.cardPending,
      ]}
      onPress={() => onPress(client)}
    >
      {/* Top Section: Avatar, Name, Status */}
      <View style={styles.topSection}>
        <View style={[
          styles.avatar,
          isActive && styles.avatarActive,
          isPending && styles.avatarPending,
        ]}>
          <Text style={[
            styles.avatarText,
            isActive && styles.avatarTextActive,
            isPending && styles.avatarTextPending,
          ]}>
            {getInitials()}
          </Text>
        </View>

        <View style={styles.nameSection}>
          <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.email} numberOfLines={1}>{displayEmail}</Text>
        </View>

        <View style={[
          styles.statusBadge,
          { backgroundColor: status.bgColor, borderColor: status.borderColor }
        ]}>
          <Feather name={status.icon} size={10} color={status.textColor} />
          <Text style={[styles.statusText, { color: status.textColor }]}>
            {status.label}
          </Text>
        </View>
      </View>

      {/* Info Pills Row */}
      <View style={styles.infoRow}>
        {/* Home Address Pill - only show if single home */}
        {homeCount <= 1 && (primaryHome || client.invitedAddress) && (
          <View style={styles.infoPill}>
            <Feather name="map-pin" size={12} color={colors.neutral[500]} />
            <Text style={styles.infoPillText} numberOfLines={1}>
              {primaryHome
                ? `${primaryHome.address?.split(",")[0] || primaryHome.city}`
                : client.invitedAddress?.address?.split(",")[0] || "Address pending"}
            </Text>
          </View>
        )}

        {/* Beds/Baths or Multi-home Badge */}
        {homeCount > 1 ? (
          <View style={[styles.infoPill, styles.infoPillHighlight]}>
            <Feather name="home" size={12} color={colors.primary[600]} />
            <Text style={[styles.infoPillText, styles.infoPillTextHighlight]}>
              {homeCount} homes
            </Text>
          </View>
        ) : beds ? (
          <View style={styles.infoPill}>
            <Feather name="layout" size={12} color={colors.neutral[500]} />
            <Text style={styles.infoPillText}>{beds}bd / {baths}ba</Text>
          </View>
        ) : null}

        {/* Price Pill - only show for single home clients */}
        {homeCount <= 1 && (client.defaultPrice || onPriceUpdate) && !editingPrice && (
          <Pressable
            style={({ pressed }) => [
              styles.pricePill,
              onPriceUpdate && styles.pricePillEditable,
              pressed && onPriceUpdate && styles.pricePillPressed,
            ]}
            onPress={onPriceUpdate ? handlePriceEdit : undefined}
            disabled={!onPriceUpdate}
          >
            <Text style={styles.pricePillText}>
              ${client.defaultPrice ? parseFloat(client.defaultPrice).toFixed(0) : "—"}
            </Text>
            {onPriceUpdate && (
              <Feather name="edit-2" size={10} color={colors.success[600]} />
            )}
          </Pressable>
        )}
      </View>

      {/* Price Edit Mode - only for single home clients */}
      {homeCount <= 1 && editingPrice && (
        <View style={styles.priceEditSection}>
          <View style={styles.priceEditRow}>
            <View style={styles.priceEditContainer}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                style={styles.priceEditInput}
                value={priceInput}
                onChangeText={setPriceInput}
                keyboardType="decimal-pad"
                autoFocus
                selectTextOnFocus
              />
            </View>
            <Pressable style={styles.priceSaveBtn} onPress={handlePriceSave}>
              <Feather name="check" size={16} color={colors.neutral[0]} />
            </Pressable>
            <Pressable style={styles.priceCancelBtn} onPress={handlePriceCancel}>
              <Feather name="x" size={16} color={colors.neutral[600]} />
            </Pressable>
          </View>
          {platformPrice && (
            <Pressable
              style={({ pressed }) => [
                styles.platformPriceBtn,
                pressed && styles.platformPriceBtnPressed,
              ]}
              onPress={handleUsePlatformPrice}
            >
              <Feather name="zap" size={12} color={colors.primary[600]} />
              <Text style={styles.platformPriceText}>
                Use platform price: ${platformPrice}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Active Client Actions */}
      {isActive && (onBookCleaning || onSetupRecurring || onMessage) && (
        <View style={styles.actionsSection}>
          <View style={styles.actionsRow}>
            {onMessage && client.clientId && (
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtnIcon,
                  pressed && styles.actionBtnIconPressed,
                ]}
                onPress={(e) => {
                  e.stopPropagation();
                  onMessage(client);
                }}
              >
                <Feather name="message-circle" size={16} color={colors.neutral[600]} />
              </Pressable>
            )}
            <View style={styles.actionsSpacer} />
            {onSetupRecurring && (
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtnSecondary,
                  pressed && styles.actionBtnSecondaryPressed,
                ]}
                onPress={(e) => {
                  e.stopPropagation();
                  onSetupRecurring(client);
                }}
              >
                <Feather name="repeat" size={14} color={colors.primary[600]} />
                <Text style={styles.actionBtnSecondaryText}>Recurring</Text>
              </Pressable>
            )}
            {onBookCleaning && (
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtnPrimary,
                  pressed && styles.actionBtnPrimaryPressed,
                ]}
                onPress={(e) => {
                  e.stopPropagation();
                  onBookCleaning(client);
                }}
              >
                <Feather name="plus-circle" size={14} color={colors.neutral[0]} />
                <Text style={styles.actionBtnPrimaryText}>Book</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Pending Invite Actions */}
      {isPending && (
        <View style={styles.pendingSection}>
          <View style={styles.pendingInfo}>
            <Feather name="send" size={12} color={colors.neutral[400]} />
            <Text style={styles.pendingText}>
              Sent {new Date(client.invitedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </Text>
          </View>
          <View style={styles.pendingActions}>
            {onDeleteInvitation && (
              <Pressable
                style={({ pressed }) => [
                  styles.pendingBtnDelete,
                  pressed && styles.pendingBtnDeletePressed,
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
                styles.pendingBtnResend,
                pressed && styles.pendingBtnResendPressed,
              ]}
              onPress={(e) => {
                e.stopPropagation();
                onResendInvite(client);
              }}
            >
              <Feather name="refresh-cw" size={14} color={colors.primary[600]} />
              <Text style={styles.pendingBtnResendText}>Resend</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Subtle Chevron */}
      <View style={styles.chevronContainer}>
        <Feather name="chevron-right" size={18} color={colors.neutral[300]} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius["2xl"],
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    ...shadows.sm,
  },
  cardPressed: {
    backgroundColor: colors.neutral[50],
    borderColor: colors.neutral[200],
  },
  cardPending: {
    borderColor: colors.warning[100],
    borderStyle: "dashed",
  },

  // Top Section
  topSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarActive: {
    backgroundColor: colors.primary[100],
  },
  avatarPending: {
    backgroundColor: colors.warning[100],
  },
  avatarText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[500],
  },
  avatarTextActive: {
    color: colors.primary[700],
  },
  avatarTextPending: {
    color: colors.warning[700],
  },
  nameSection: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  email: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 4,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Info Row
  infoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  infoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.full,
  },
  infoPillHighlight: {
    backgroundColor: colors.primary[50],
  },
  infoPillText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[600],
    fontWeight: typography.fontWeight.medium,
  },
  infoPillTextHighlight: {
    color: colors.primary[700],
  },
  pricePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.success[50],
    borderRadius: radius.full,
    marginLeft: "auto",
  },
  pricePillEditable: {
    borderWidth: 1,
    borderColor: colors.success[200],
    borderStyle: "dashed",
  },
  pricePillPressed: {
    backgroundColor: colors.success[100],
  },
  pricePillText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
    fontWeight: typography.fontWeight.bold,
  },

  // Price Edit Section
  priceEditSection: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  priceEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  priceEditContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  dollarSign: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[400],
  },
  priceEditInput: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.xs,
  },
  priceSaveBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.success[600],
    alignItems: "center",
    justifyContent: "center",
  },
  priceCancelBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[200],
    alignItems: "center",
    justifyContent: "center",
  },
  platformPriceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primary[50],
    borderRadius: radius.full,
  },
  platformPriceBtnPressed: {
    backgroundColor: colors.primary[100],
  },
  platformPriceText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[700],
    fontWeight: typography.fontWeight.medium,
  },

  // Actions Section
  actionsSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  actionsSpacer: {
    flex: 1,
  },
  actionBtnIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnIconPressed: {
    backgroundColor: colors.neutral[200],
  },
  actionBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  actionBtnSecondaryPressed: {
    backgroundColor: colors.primary[100],
  },
  actionBtnSecondaryText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  actionBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary[600],
    borderRadius: radius.lg,
    ...shadows.sm,
  },
  actionBtnPrimaryPressed: {
    backgroundColor: colors.primary[700],
  },
  actionBtnPrimaryText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },

  // Pending Section
  pendingSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  pendingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  pendingText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[400],
  },
  pendingActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  pendingBtnDelete: {
    width: 34,
    height: 34,
    borderRadius: radius.lg,
    backgroundColor: colors.error[50],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.error[100],
  },
  pendingBtnDeletePressed: {
    backgroundColor: colors.error[100],
  },
  pendingBtnResend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  pendingBtnResendPressed: {
    backgroundColor: colors.primary[100],
  },
  pendingBtnResendText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },

  // Chevron
  chevronContainer: {
    position: "absolute",
    right: spacing.md,
    top: spacing.lg + 12,
  },
});

export default ClientCard;
