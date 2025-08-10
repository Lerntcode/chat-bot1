module.exports = {
  async up({ context: queryInterface }) {
    // Conversations: frequently queried by userId, lastMessageTimestamp
    await queryInterface.addIndex('Conversations', ['userId', 'lastMessageTimestamp']);
    // Messages: order by conversationId, timestamp
    await queryInterface.addIndex('Messages', ['conversationId', 'timestamp']);
    // TokenUsage: lookups by userId createdAt
    await queryInterface.addIndex('TokenUsages', ['userId', 'createdAt']);
    // AdViews: lookups by userId createdAt
    await queryInterface.addIndex('AdViews', ['userId', 'createdAt']);
    // Payments: lookups by userId createdAt
    await queryInterface.addIndex('Payments', ['userId', 'createdAt']);
    // ModelTokenBalances: by userId, modelId
    await queryInterface.addIndex('ModelTokenBalances', ['userId', 'modelId'], { unique: false });
    // Memories: userId timestamp
    await queryInterface.addIndex('Memories', ['userId', 'timestamp']);
  },
  async down({ context: queryInterface }) {
    await queryInterface.removeIndex('Conversations', ['userId', 'lastMessageTimestamp']);
    await queryInterface.removeIndex('Messages', ['conversationId', 'timestamp']);
    await queryInterface.removeIndex('TokenUsages', ['userId', 'createdAt']);
    await queryInterface.removeIndex('AdViews', ['userId', 'createdAt']);
    await queryInterface.removeIndex('Payments', ['userId', 'createdAt']);
    await queryInterface.removeIndex('ModelTokenBalances', ['userId', 'modelId']);
    await queryInterface.removeIndex('Memories', ['userId', 'timestamp']);
  }
};
