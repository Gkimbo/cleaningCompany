import React from "react";
import { View, Text } from "react-native";
import messagingStyles from "../../services/styles/MessagingStyles";

const MessageBubble = ({ message, isOwn, isBroadcast }) => {
  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (isBroadcast) {
    return (
      <View style={[messagingStyles.messageBubble, messagingStyles.messageBubbleBroadcast]}>
        <Text style={messagingStyles.messageSender}>
          {message.sender?.username || "Owner"}
        </Text>
        <Text style={[messagingStyles.messageText, messagingStyles.messageTextReceived]}>
          {message.content}
        </Text>
        <Text style={[messagingStyles.messageTime, messagingStyles.messageTimeReceived]}>
          {formatTime(message.createdAt)}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        messagingStyles.messageBubble,
        isOwn ? messagingStyles.messageBubbleSent : messagingStyles.messageBubbleReceived,
      ]}
    >
      {!isOwn && message.sender && (
        <Text style={messagingStyles.messageSender}>
          {message.sender.username}
        </Text>
      )}
      <Text
        style={[
          messagingStyles.messageText,
          isOwn ? messagingStyles.messageTextSent : messagingStyles.messageTextReceived,
        ]}
      >
        {message.content}
      </Text>
      <Text
        style={[
          messagingStyles.messageTime,
          isOwn ? messagingStyles.messageTimeSent : messagingStyles.messageTimeReceived,
        ]}
      >
        {formatTime(message.createdAt)}
      </Text>
    </View>
  );
};

export default MessageBubble;
