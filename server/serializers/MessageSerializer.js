const EncryptionService = require("../services/EncryptionService");

class MessageSerializer {
	// User fields that are encrypted
	static userEncryptedFields = ["firstName", "lastName", "email", "phone"];

	static decryptUserField(value) {
		if (!value) return null;
		const decrypted = EncryptionService.decrypt(value);
		// Debug: log if decryption returned same value (likely failed)
		if (decrypted === value && value.includes(':')) {
			console.warn('[MessageSerializer] Decryption may have failed for value');
		}
		return decrypted;
	}

	static serializeUser(user) {
		if (!user) return null;
		const data = user.dataValues || user;
		return {
			id: data.id,
			username: data.username,
			firstName: this.decryptUserField(data.firstName),
			lastName: this.decryptUserField(data.lastName),
			email: this.decryptUserField(data.email),
			type: data.type
		};
	}

	static serializeOne(message) {
		const data = message.dataValues || message;

		const serialized = {
			id: data.id,
			conversationId: data.conversationId,
			senderId: data.senderId,
			content: data.content,
			messageType: data.messageType,
			hasSuspiciousContent: data.hasSuspiciousContent,
			suspiciousContentTypes: data.suspiciousContentTypes,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt
		};

		// Serialize sender if included
		if (message.sender) {
			serialized.sender = this.serializeUser(message.sender);
		}

		// Serialize reactions if included
		if (message.reactions) {
			serialized.reactions = message.reactions.map(reaction => ({
				id: reaction.id,
				emoji: reaction.emoji,
				userId: reaction.userId
			}));
		}

		// Serialize read receipts if included
		if (message.readReceipts) {
			serialized.readReceipts = message.readReceipts.map(receipt => ({
				userId: receipt.userId,
				readAt: receipt.readAt
			}));
		}

		return serialized;
	}

	static serializeArray(messages) {
		return messages.map((message) => this.serializeOne(message));
	}

	static serializeConversation(conversation) {
		const data = conversation.dataValues || conversation;

		const serialized = {
			id: data.id,
			appointmentId: data.appointmentId,
			conversationType: data.conversationType,
			title: data.title,
			createdBy: data.createdBy,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt
		};

		// Serialize creator if included
		if (conversation.creator) {
			serialized.creator = this.serializeUser(conversation.creator);
		}

		// Serialize messages if included
		if (conversation.messages) {
			serialized.messages = this.serializeArray(conversation.messages);
		}

		// Serialize participants if included
		if (conversation.participants) {
			serialized.participants = conversation.participants.map(participant =>
				this.serializeParticipant(participant)
			);
		}

		return serialized;
	}

	static serializeConversationArray(conversations) {
		return conversations.map((conversation) => this.serializeConversation(conversation));
	}

	static serializeParticipant(participant) {
		const data = participant.dataValues || participant;

		const serialized = {
			id: data.id,
			conversationId: data.conversationId,
			userId: data.userId,
			lastReadAt: data.lastReadAt
		};

		// Serialize user if included
		if (participant.user) {
			serialized.user = this.serializeUser(participant.user);
		}

		return serialized;
	}

	static serializeConversationListItem(conversation) {
		const data = conversation.dataValues || conversation;

		const serialized = {
			id: data.id,
			conversationType: data.conversationType,
			title: data.title,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt
		};

		// Include last message if available
		if (conversation.messages && conversation.messages.length > 0) {
			const lastMessage = conversation.messages[conversation.messages.length - 1];
			serialized.lastMessage = {
				content: lastMessage.content,
				senderId: lastMessage.senderId,
				createdAt: lastMessage.createdAt
			};
		}

		// Include participants if available
		if (conversation.participants) {
			serialized.participants = conversation.participants.map(participant =>
				this.serializeParticipant(participant)
			);
		}

		return serialized;
	}
}

module.exports = MessageSerializer;
