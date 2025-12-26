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
  onDelete,
  drag,
  isActive,
}) => {
  const { content, formatting = {}, indentLevel = 0 } = item;
  const paddingLeft = indentLevel * 24;

  return (
    <Pressable
      onPress={() => onSelect(item)}
      onLongPress={drag}
      style={[
        styles.itemRow,
        isSelected && styles.itemRowSelected,
        isActive && { opacity: 0.8 },
        { marginLeft: paddingLeft },
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
  );
};

export default ChecklistItemRow;
