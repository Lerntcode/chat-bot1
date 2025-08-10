const { Umzug, SequelizeStorage } = require('umzug');
const path = require('path');
const { sequelize } = require('../config/database');

async function runMigrations() {
  const migrator = new Umzug({
    migrations: {
      glob: path.resolve(__dirname, '../migrations/*.js'),
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: console,
  });

  await migrator.up();
}

module.exports = { runMigrations };

if (require.main === module) {
  runMigrations().then(() => {
    console.log('Migrations completed');
    process.exit(0);
  }).catch(err => {
    console.error('Migration failed', err);
    process.exit(1);
  });
}
