module.exports = {
  async up({ context: qi }) {
    await qi.addColumn('Memories', 'category', { type: 'STRING', allowNull: true });
    await qi.addColumn('Memories', 'expiresAt', { type: 'DATE', allowNull: true });
    await qi.addIndex('Memories', ['category']);
    await qi.addIndex('Memories', ['expiresAt']);
  },
  async down({ context: qi }) {
    await qi.removeIndex('Memories', ['category']);
    await qi.removeIndex('Memories', ['expiresAt']);
    await qi.removeColumn('Memories', 'category');
    await qi.removeColumn('Memories', 'expiresAt');
  }
};
