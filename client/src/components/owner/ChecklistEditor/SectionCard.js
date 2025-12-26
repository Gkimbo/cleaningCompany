import React from "react";
import { View, TextInput, Pressable, Text } from "react-native";
import DraggableFlatList from "react-native-draggable-flatlist";
import ChecklistItemRow from "./ChecklistItemRow";
import styles from "./ChecklistEditorStyles";

const SectionCard = ({
  section,
  selectedItem,
  onSelectItem,
  onTitleChange,
  onIconChange,
  onItemContentChange,
  onItemReorder,
  onAddItem,
  onDeleteItem,
  onDeleteSection,
  drag,
  isActive,
}) => {
  const renderItem = ({ item, index, drag: itemDrag, isActive: itemIsActive }) => (
    <ChecklistItemRow
      item={item}
      index={index}
      isSelected={selectedItem?.id === item.id}
      onSelect={onSelectItem}
      onContentChange={onItemContentChange}
      onDelete={onDeleteItem}
      drag={itemDrag}
      isActive={itemIsActive}
    />
  );

  const handleDragEnd = ({ data }) => {
    onItemReorder(section.id, data);
  };

  return (
    <View style={[styles.sectionCard, isActive && { opacity: 0.9 }]}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        {/* Drag Handle */}
        <Pressable onLongPress={drag} style={styles.sectionDragHandle}>
          <Text style={styles.sectionDragHandleText}>{"\u2630"}</Text>
        </Pressable>

        {/* Icon */}
        <Pressable
          style={styles.sectionIcon}
          onPress={() => {
            // Could add icon picker later
          }}
        >
          <Text style={styles.sectionIconText}>{section.icon || "S"}</Text>
        </Pressable>

        {/* Title Input */}
        <TextInput
          style={styles.sectionTitleInput}
          value={section.title}
          onChangeText={(text) => onTitleChange(section.id, text)}
          placeholder="Section Title"
        />

        {/* Actions */}
        <View style={styles.sectionActions}>
          <Pressable
            style={styles.sectionActionButton}
            onPress={() => onDeleteSection(section.id)}
          >
            <Text style={[styles.sectionActionButtonText, { color: "#EF4444" }]}>
              {"\u00D7"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Section Content - Items */}
      <View style={styles.sectionContent}>
        {section.items && section.items.length > 0 ? (
          <DraggableFlatList
            data={section.items}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            onDragEnd={handleDragEnd}
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No items in this section</Text>
          </View>
        )}

        {/* Add Item Button */}
        <Pressable
          style={styles.addItemButton}
          onPress={() => onAddItem(section.id)}
        >
          <Text style={styles.addItemButtonText}>+ Add Task</Text>
        </Pressable>
      </View>
    </View>
  );
};

export default SectionCard;
