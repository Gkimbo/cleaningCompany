'use strict';

module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define("Message", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    conversationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Conversations",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    senderId: {
      type: DataTypes.INTEGER,
      allowNull: true,  // Allow null for system messages
      references: {
        model: "Users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    messageType: {
      type: DataTypes.ENUM("text", "broadcast", "system"),
      allowNull: false,
      defaultValue: "text",
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    hasSuspiciousContent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    suspiciousContentTypes: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
  });

  Message.associate = (models) => {
    Message.belongsTo(models.Conversation, {
      foreignKey: "conversationId",
      as: "conversation",
    });
    Message.belongsTo(models.User, {
      foreignKey: "senderId",
      as: "sender",
    });
    Message.hasMany(models.MessageReaction, {
      foreignKey: "messageId",
      as: "reactions",
    });
    Message.hasMany(models.MessageReadReceipt, {
      foreignKey: "messageId",
      as: "readReceipts",
    });
  };

  return Message;
};
