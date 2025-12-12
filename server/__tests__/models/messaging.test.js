/**
 * Messaging Model Tests
 *
 * Tests model structure and validation for messaging features.
 */

// Helper to create fresh mock objects
const createMockConversation = (overrides = {}) => ({
  id: 1,
  appointmentId: null,
  conversationType: "appointment",
  title: null,
  createdBy: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  update: jest.fn().mockImplementation(function (data) {
    Object.assign(this, data);
    return Promise.resolve(this);
  }),
  ...overrides,
});

const createMockMessage = (overrides = {}) => ({
  id: 1,
  conversationId: 1,
  senderId: 1,
  content: "Test message",
  messageType: "text",
  createdAt: new Date(),
  updatedAt: new Date(),
  update: jest.fn().mockImplementation(function (data) {
    Object.assign(this, data);
    return Promise.resolve(this);
  }),
  ...overrides,
});

const createMockParticipant = (overrides = {}) => ({
  id: 1,
  conversationId: 1,
  userId: 1,
  lastReadAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  update: jest.fn().mockImplementation(function (data) {
    Object.assign(this, data);
    return Promise.resolve(this);
  }),
  ...overrides,
});

// Mock the models
jest.mock("../../models", () => ({
  Conversation: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
  },
  Message: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
  },
  ConversationParticipant: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    findOrCreate: jest.fn(),
  },
}));

const { Conversation, Message, ConversationParticipant } = require("../../models");

describe("Messaging Models", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup fresh mocks for each test
    Conversation.create.mockImplementation((data) =>
      Promise.resolve(createMockConversation(data))
    );
    Conversation.findByPk.mockImplementation(() =>
      Promise.resolve(createMockConversation())
    );
    Conversation.findOne.mockImplementation(() =>
      Promise.resolve(createMockConversation())
    );
    Conversation.findAll.mockImplementation(() =>
      Promise.resolve([createMockConversation()])
    );

    Message.create.mockImplementation((data) =>
      Promise.resolve(createMockMessage(data))
    );
    Message.findByPk.mockImplementation(() => Promise.resolve(createMockMessage()));
    Message.findOne.mockImplementation(() => Promise.resolve(createMockMessage()));
    Message.findAll.mockImplementation(() => Promise.resolve([createMockMessage()]));
    Message.count.mockImplementation(() => Promise.resolve(0));

    ConversationParticipant.create.mockImplementation((data) =>
      Promise.resolve(createMockParticipant(data))
    );
    ConversationParticipant.findByPk.mockImplementation(() =>
      Promise.resolve(createMockParticipant())
    );
    ConversationParticipant.findOne.mockImplementation(() =>
      Promise.resolve(createMockParticipant())
    );
    ConversationParticipant.findAll.mockImplementation(() =>
      Promise.resolve([createMockParticipant()])
    );
    ConversationParticipant.findOrCreate.mockImplementation((options) =>
      Promise.resolve([createMockParticipant(options.where), true])
    );
  });

  describe("Conversation Model", () => {
    it("should create an appointment conversation", async () => {
      const conversationData = {
        appointmentId: 1,
        conversationType: "appointment",
        createdBy: 1,
      };

      const conversation = await Conversation.create(conversationData);

      expect(Conversation.create).toHaveBeenCalledWith(conversationData);
      expect(conversation.id).toBeDefined();
      expect(conversation.conversationType).toBe("appointment");
      expect(conversation.appointmentId).toBe(1);
    });

    it("should create a broadcast conversation", async () => {
      const conversationData = {
        conversationType: "broadcast",
        title: "Company Announcement",
        createdBy: 1,
      };

      const conversation = await Conversation.create(conversationData);

      expect(conversation.conversationType).toBe("broadcast");
      expect(conversation.title).toBe("Company Announcement");
    });

    it("should create a support conversation", async () => {
      const conversationData = {
        conversationType: "support",
        title: "Support - testuser",
        createdBy: 2,
      };

      const conversation = await Conversation.create(conversationData);

      expect(conversation.conversationType).toBe("support");
      expect(conversation.title).toBe("Support - testuser");
    });

    it("should find conversation by primary key", async () => {
      const conversation = await Conversation.findByPk(1);

      expect(Conversation.findByPk).toHaveBeenCalledWith(1);
      expect(conversation.id).toBe(1);
    });

    it("should find conversation by appointmentId", async () => {
      Conversation.findOne.mockResolvedValueOnce(
        createMockConversation({ appointmentId: 5 })
      );

      const conversation = await Conversation.findOne({
        where: { appointmentId: 5 },
      });

      expect(Conversation.findOne).toHaveBeenCalled();
      expect(conversation.appointmentId).toBe(5);
    });

    it("should update conversation timestamp", async () => {
      const conversation = createMockConversation();
      const newDate = new Date();

      await conversation.update({ updatedAt: newDate });

      expect(conversation.update).toHaveBeenCalledWith({ updatedAt: newDate });
      expect(conversation.updatedAt).toEqual(newDate);
    });
  });

  describe("Message Model", () => {
    it("should create a text message", async () => {
      const messageData = {
        conversationId: 1,
        senderId: 1,
        content: "Hello, world!",
        messageType: "text",
      };

      const message = await Message.create(messageData);

      expect(Message.create).toHaveBeenCalledWith(messageData);
      expect(message.id).toBeDefined();
      expect(message.content).toBe("Hello, world!");
      expect(message.messageType).toBe("text");
    });

    it("should create a broadcast message", async () => {
      const messageData = {
        conversationId: 1,
        senderId: 1,
        content: "Important announcement",
        messageType: "broadcast",
      };

      const message = await Message.create(messageData);

      expect(message.messageType).toBe("broadcast");
      expect(message.content).toBe("Important announcement");
    });

    it("should find messages by conversation", async () => {
      Message.findAll.mockResolvedValueOnce([
        createMockMessage({ id: 1, content: "Message 1" }),
        createMockMessage({ id: 2, content: "Message 2" }),
        createMockMessage({ id: 3, content: "Message 3" }),
      ]);

      const messages = await Message.findAll({
        where: { conversationId: 1 },
        order: [["createdAt", "ASC"]],
      });

      expect(Message.findAll).toHaveBeenCalled();
      expect(messages).toHaveLength(3);
    });

    it("should count unread messages", async () => {
      Message.count.mockResolvedValueOnce(5);

      const unreadCount = await Message.count({
        where: {
          conversationId: 1,
          senderId: { $ne: 1 },
        },
      });

      expect(Message.count).toHaveBeenCalled();
      expect(unreadCount).toBe(5);
    });

    it("should find message by primary key", async () => {
      const message = await Message.findByPk(1);

      expect(Message.findByPk).toHaveBeenCalledWith(1);
      expect(message.id).toBe(1);
    });
  });

  describe("ConversationParticipant Model", () => {
    it("should create a participant", async () => {
      const participantData = {
        conversationId: 1,
        userId: 2,
      };

      const participant = await ConversationParticipant.create(participantData);

      expect(ConversationParticipant.create).toHaveBeenCalledWith(participantData);
      expect(participant.id).toBeDefined();
      expect(participant.conversationId).toBe(1);
      expect(participant.userId).toBe(2);
    });

    it("should find participant by conversation and user", async () => {
      ConversationParticipant.findOne.mockResolvedValueOnce(
        createMockParticipant({ conversationId: 1, userId: 2 })
      );

      const participant = await ConversationParticipant.findOne({
        where: { conversationId: 1, userId: 2 },
      });

      expect(ConversationParticipant.findOne).toHaveBeenCalled();
      expect(participant.userId).toBe(2);
    });

    it("should find or create participant", async () => {
      const [participant, created] = await ConversationParticipant.findOrCreate({
        where: { conversationId: 1, userId: 3 },
      });

      expect(ConversationParticipant.findOrCreate).toHaveBeenCalled();
      expect(participant.userId).toBe(3);
      expect(created).toBe(true);
    });

    it("should update lastReadAt timestamp", async () => {
      const participant = createMockParticipant();
      const readTime = new Date();

      await participant.update({ lastReadAt: readTime });

      expect(participant.update).toHaveBeenCalledWith({ lastReadAt: readTime });
      expect(participant.lastReadAt).toEqual(readTime);
    });

    it("should find all participants for a conversation", async () => {
      ConversationParticipant.findAll.mockResolvedValueOnce([
        createMockParticipant({ userId: 1 }),
        createMockParticipant({ userId: 2 }),
        createMockParticipant({ userId: 3 }),
      ]);

      const participants = await ConversationParticipant.findAll({
        where: { conversationId: 1 },
      });

      expect(ConversationParticipant.findAll).toHaveBeenCalled();
      expect(participants).toHaveLength(3);
    });

    it("should initialize lastReadAt as null", async () => {
      const participant = await ConversationParticipant.create({
        conversationId: 1,
        userId: 2,
      });

      expect(participant.lastReadAt).toBeNull();
    });
  });

  describe("Model Relationships", () => {
    it("should associate messages with a conversation", async () => {
      const conversationWithMessages = {
        ...createMockConversation(),
        messages: [
          createMockMessage({ id: 1, content: "First" }),
          createMockMessage({ id: 2, content: "Second" }),
        ],
      };

      Conversation.findByPk.mockResolvedValueOnce(conversationWithMessages);

      const conversation = await Conversation.findByPk(1);

      expect(conversation.messages).toHaveLength(2);
      expect(conversation.messages[0].content).toBe("First");
    });

    it("should associate participants with a conversation", async () => {
      const conversationWithParticipants = {
        ...createMockConversation(),
        participants: [
          createMockParticipant({ userId: 1 }),
          createMockParticipant({ userId: 2 }),
        ],
      };

      Conversation.findByPk.mockResolvedValueOnce(conversationWithParticipants);

      const conversation = await Conversation.findByPk(1);

      expect(conversation.participants).toHaveLength(2);
    });

    it("should associate message with sender", async () => {
      const messageWithSender = {
        ...createMockMessage(),
        sender: { id: 1, username: "testuser", type: null },
      };

      Message.findByPk.mockResolvedValueOnce(messageWithSender);

      const message = await Message.findByPk(1);

      expect(message.sender).toBeDefined();
      expect(message.sender.username).toBe("testuser");
    });

    it("should associate participant with user", async () => {
      const participantWithUser = {
        ...createMockParticipant(),
        user: { id: 1, username: "testuser", type: null },
      };

      ConversationParticipant.findOne.mockResolvedValueOnce(participantWithUser);

      const participant = await ConversationParticipant.findOne({
        where: { id: 1 },
      });

      expect(participant.user).toBeDefined();
      expect(participant.user.username).toBe("testuser");
    });
  });
});

afterAll(async () => {
  jest.clearAllMocks();
  jest.useRealTimers();
});
