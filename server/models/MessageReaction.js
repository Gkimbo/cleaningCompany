module.exports = (sequelize, DataTypes) => {
  const MessageReaction = sequelize.define("MessageReaction", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    messageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Messages",
        key: "id",
      },
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Users",
        key: "id",
      },
    },
    emoji: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
  });

  MessageReaction.associate = (models) => {
    MessageReaction.belongsTo(models.Message, {
      foreignKey: "messageId",
      as: "message",
    });
    MessageReaction.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });
  };

  return MessageReaction;
};
