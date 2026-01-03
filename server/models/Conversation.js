'use strict';

module.exports = (sequelize, DataTypes) => {
  const Conversation = sequelize.define("Conversation", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    appointmentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "UserAppointments",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    conversationType: {
      type: DataTypes.ENUM("appointment", "broadcast", "support", "internal", "cleaner-client"),
      allowNull: false,
      defaultValue: "appointment",
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
  });

  Conversation.associate = (models) => {
    Conversation.belongsTo(models.UserAppointments, {
      foreignKey: "appointmentId",
      as: "appointment",
    });
    Conversation.belongsTo(models.User, {
      foreignKey: "createdBy",
      as: "creator",
    });
    Conversation.hasMany(models.Message, {
      foreignKey: "conversationId",
      as: "messages",
    });
    Conversation.hasMany(models.ConversationParticipant, {
      foreignKey: "conversationId",
      as: "participants",
    });
  };

  return Conversation;
};
