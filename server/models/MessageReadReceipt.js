module.exports = (sequelize, DataTypes) => {
  const MessageReadReceipt = sequelize.define("MessageReadReceipt", {
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
    readAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  MessageReadReceipt.associate = (models) => {
    MessageReadReceipt.belongsTo(models.Message, {
      foreignKey: "messageId",
      as: "message",
    });
    MessageReadReceipt.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });
  };

  return MessageReadReceipt;
};
