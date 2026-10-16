const path = require('path');
const express = require('express');
const { pool, initDb } = require('./db');
const employeeRoutes = require('./routes/employees');
const { DEPARTMENTS } = require('./validate');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Liveness probe: "is the process alive?" Does NOT touch the database.
// If this fails, Kubernetes restarts the container.
app.get('/healthz', (req, res) => res.json({ status: 'ok' }));

// Readiness probe: "can this pod serve traffic?" Checks the database.
// If this fails, Kubernetes stops sending traffic to the pod (but does not restart it).
app.get('/readyz', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready', database: 'up' });
  } catch (err) {
    res.status(503).json({ status: 'not ready', database: 'down' });
  }
});

app.get('/api/config', (req, res) => res.json({ departments: DEPARTMENTS }));
app.use('/api/employees', employeeRoutes);

// 404 for unknown API routes
app.use('/api', (req, res) => res.status(404).json({ errors: ['Not found'] }));

// Central error handler: log details server-side, return a generic message to the client
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ errors: ['Something went wrong. Please try again.'] });
});

async function start() {
  await initDb();
  const server = app.listen(PORT, () => console.log(`Employee app listening on port ${PORT}`));

  // Graceful shutdown: Kubernetes sends SIGTERM before killing a pod.
  // Finish in-flight requests, close DB connections, then exit.
  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start application:', err);
    process.exit(1);
  });
}

module.exports = app;
