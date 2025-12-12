'use strict';

module.exports = (sequelize, DataTypes) => {
  const ConversationParticipant = sequelize.define("ConversationParticipant", {
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
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    lastReadAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });

  ConversationParticipant.associate = (models) => {
    ConversationParticipant.belongsTo(models.Conversation, {
      foreignKey: "conversationId",
      as: "conversation",
    });
    ConversationParticipant.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });
  };

  return ConversationParticipant;
};
