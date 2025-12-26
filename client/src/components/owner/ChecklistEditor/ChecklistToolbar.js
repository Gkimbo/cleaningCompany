import React from "react";
import { View, Pressable, Text, ScrollView } from "react-native";
import styles from "./ChecklistEditorStyles";

const ChecklistToolbar = ({
  selectedItem,
  onFormatBold,
  onFormatItalic,
  onBulletDisc,
  onBulletCircle,
  onBulletNumber,
  onIndent,
  onOutdent,
  onAddItem,
  onDeleteItem,
  disabled,
}) => {
  const formatting = selectedItem?.formatting || {};
  const indentLevel = selectedItem?.indentLevel || 0;

  return (
    <View style={styles.toolbar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.toolbarContent}
      >
        {/* Bold */}
        <Pressable
          style={[
            styles.toolbarButton,
            formatting.bold && styles.toolbarButtonActive,
            disabled && styles.toolbarButtonDisabled,
          ]}
          onPress={onFormatBold}
          disabled={disabled}
        >
          <Text
            style={[
              styles.toolbarButtonText,
              formatting.bold && styles.toolbarButtonTextActive,
              { fontWeight: "bold" },
            ]}
          >
            B
          </Text>
        </Pressable>

        {/* Italic */}
        <Pressable
          style={[
            styles.toolbarButton,
            formatting.italic && styles.toolbarButtonActive,
            disabled && styles.toolbarButtonDisabled,
          ]}
          onPress={onFormatItalic}
          disabled={disabled}
        >
          <Text
            style={[
              styles.toolbarButtonText,
              formatting.italic && styles.toolbarButtonTextActive,
              { fontStyle: "italic" },
            ]}
          >
            I
          </Text>
        </Pressable>

        <View style={styles.toolbarDivider} />

        {/* Disc bullet */}
        <Pressable
          style={[
            styles.toolbarButton,
            formatting.bulletStyle === "disc" && styles.toolbarButtonActive,
            disabled && styles.toolbarButtonDisabled,
          ]}
          onPress={onBulletDisc}
          disabled={disabled}
        >
          <Text
            style={[
              styles.toolbarButtonText,
              formatting.bulletStyle === "disc" && styles.toolbarButtonTextActive,
            ]}
          >
            {"\u2022"}
          </Text>
        </Pressable>

        {/* Circle bullet */}
        <Pressable
          style={[
            styles.toolbarButton,
            formatting.bulletStyle === "circle" && styles.toolbarButtonActive,
            disabled && styles.toolbarButtonDisabled,
          ]}
          onPress={onBulletCircle}
          disabled={disabled}
        >
          <Text
            style={[
              styles.toolbarButtonText,
              formatting.bulletStyle === "circle" && styles.toolbarButtonTextActive,
            ]}
          >
            {"\u25CB"}
          </Text>
        </Pressable>

        {/* Numbered list */}
        <Pressable
          style={[
            styles.toolbarButton,
            formatting.bulletStyle === "number" && styles.toolbarButtonActive,
            disabled && styles.toolbarButtonDisabled,
          ]}
          onPress={onBulletNumber}
          disabled={disabled}
        >
          <Text
            style={[
              styles.toolbarButtonText,
              formatting.bulletStyle === "number" && styles.toolbarButtonTextActive,
              { fontSize: 12 },
            ]}
          >
            1.
          </Text>
        </Pressable>

        <View style={styles.toolbarDivider} />

        {/* Indent */}
        <Pressable
          style={[
            styles.toolbarButton,
            (disabled || indentLevel >= 2) && styles.toolbarButtonDisabled,
          ]}
          onPress={onIndent}
          disabled={disabled || indentLevel >= 2}
        >
          <Text style={styles.toolbarButtonText}>{"\u2192"}</Text>
        </Pressable>

        {/* Outdent */}
        <Pressable
          style={[
            styles.toolbarButton,
            (disabled || indentLevel <= 0) && styles.toolbarButtonDisabled,
          ]}
          onPress={onOutdent}
          disabled={disabled || indentLevel <= 0}
        >
          <Text style={styles.toolbarButtonText}>{"\u2190"}</Text>
        </Pressable>

        <View style={styles.toolbarDivider} />

        {/* Add Item */}
        <Pressable style={styles.toolbarButton} onPress={onAddItem}>
          <Text style={[styles.toolbarButtonText, { color: "#10B981" }]}>+</Text>
        </Pressable>

        {/* Delete Item */}
        <Pressable
          style={[styles.toolbarButton, disabled && styles.toolbarButtonDisabled]}
          onPress={onDeleteItem}
          disabled={disabled}
        >
          <Text style={[styles.toolbarButtonText, { color: "#EF4444" }]}>
            {"\uD83D\uDDD1"}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

export default ChecklistToolbar;
