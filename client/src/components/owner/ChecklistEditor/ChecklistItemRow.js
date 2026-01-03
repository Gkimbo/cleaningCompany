import React from "react";
import { View, TextInput, Pressable, Text } from "react-native";
import styles from "./ChecklistEditorStyles";

const getBulletChar = (bulletStyle, index) => {
  switch (bulletStyle) {
    case "circle":
      return "\u25CB";
    case "number":
      return `${index + 1}.`;
    case "disc":
    default:
      return "\u2022";
  }
};

const ChecklistItemRow = ({
  item,
  index,
  isSelected,
  onSelect,
  onContentChange,
  onProTipChange,
  onDelete,
  drag,
  isActive,
}) => {
  const { content, proTip, formatting = {}, indentLevel = 0 } = item;
  const paddingLeft = indentLevel * 24;

  const handleDeleteProTip = () => {
    onProTipChange(item.id, null);
  };

  const handleAddProTip = () => {
    onProTipChange(item.id, "");
  };

  // Show pro tip box if: has a pro tip OR is selected and actively editing (proTip is empty string)
  const showProTipBox = proTip !== null && proTip !== undefined;
  // Show add pro tip button only when selected and no pro tip exists
  const showAddProTipButton = isSelected && !showProTipBox;

  return (
    <View style={[{ marginLeft: paddingLeft }]}>
      <Pressable
        onPress={() => onSelect(item)}
        onLongPress={drag}
        style={[
          styles.itemRow,
          isSelected && styles.itemRowSelected,
          isActive && { opacity: 0.8 },
        ]}
      >
        {/* Drag Handle */}
        <View style={styles.itemDragHandle}>
          <Text style={styles.itemDragHandleText}>{"\u2630"}</Text>
        </View>

        {/* Bullet */}
        <View style={styles.itemBullet}>
          <Text style={styles.itemBulletText}>
            {getBulletChar(formatting.bulletStyle, index)}
          </Text>
        </View>

        {/* Content Input */}
        <TextInput
          style={[
            styles.itemContentInput,
            formatting.bold && styles.itemContentInputBold,
            formatting.italic && styles.itemContentInputItalic,
          ]}
          value={content}
          onChangeText={(text) => onContentChange(item.id, text)}
          onFocus={() => onSelect(item)}
          placeholder="Enter task..."
          multiline={false}
        />

        {/* Delete Button */}
        <Pressable
          style={styles.itemDeleteButton}
          onPress={() => onDelete(item.id)}
        >
          <Text style={styles.itemDeleteButtonText}>{"\u00D7"}</Text>
        </Pressable>
      </Pressable>

      {/* Pro Tip Box - shown when pro tip exists */}
      {showProTipBox && (
        <View style={styles.proTipContainer}>
          <View style={styles.proTipBox}>
            <View style={styles.proTipHeader}>
              <Text style={styles.proTipIcon}>💡</Text>
              <Text style={styles.proTipLabel}>Pro Tip</Text>
            </View>
            {isSelected ? (
              <>
                <TextInput
                  style={styles.proTipInput}
                  value={proTip || ""}
                  onChangeText={(text) => onProTipChange(item.id, text)}
                  placeholder="Enter a helpful tip for cleaners..."
                  placeholderTextColor="#9CA3AF"
                  multiline={true}
                  numberOfLines={2}
                />
                <View style={styles.proTipActions}>
                  <Text style={{ fontSize: 11, color: "#9CA3AF" }}>
                    Tips help cleaners do a better job
                  </Text>
                  <Pressable
                    style={styles.proTipDeleteButton}
                    onPress={handleDeleteProTip}
                  >
                    <Text style={styles.proTipDeleteButtonText}>Remove Tip</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Text style={styles.proTipText}>{proTip}</Text>
            )}
          </View>
        </View>
      )}

      {/* Add Pro Tip Button - shown when selected and no pro tip */}
      {showAddProTipButton && (
        <Pressable style={styles.addProTipButton} onPress={handleAddProTip}>
          <Text style={{ fontSize: 14 }}>💡</Text>
          <Text style={styles.addProTipButtonText}>Add Pro Tip</Text>
        </Pressable>
      )}
    </View>
  );
};

export default ChecklistItemRow;
