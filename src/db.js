const mysql = require('mysql2/promise');

// Connection settings come from environment variables.
// In Kubernetes these are injected from a ConfigMap (host, port, db name)
// and a Secret (user, password), so no credentials live in the image.
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'empapp',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'employees',
  waitForConnections: true,
  connectionLimit: 10,
};

const pool = mysql.createPool(config);

const CREATE_EMPLOYEES_TABLE = `
  CREATE TABLE IF NOT EXISTS employees (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    first_name      VARCHAR(80)  NOT NULL,
    last_name       VARCHAR(80)  NOT NULL,
    email           VARCHAR(190) NOT NULL UNIQUE,
    phone           VARCHAR(20)  NULL,
    department      VARCHAR(80)  NOT NULL,
    designation     VARCHAR(120) NOT NULL,
    date_of_joining DATE         NOT NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The database container may take a few seconds to start, so retry on boot
// instead of crashing. Kubernetes would restart the pod anyway, but retrying
// here is faster and produces clearer logs.
async function initDb(retries = 10, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query(CREATE_EMPLOYEES_TABLE);
      console.log('Database ready: employees table is in place');
      return;
    } catch (err) {
      console.error(`DB not ready (attempt ${attempt}/${retries}): ${err.code || err.message}`);
      if (attempt === retries) throw err;
      await sleep(delayMs);
    }
  }
}

module.exports = { pool, initDb };
