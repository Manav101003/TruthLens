const express = require('express');
const cors = require('cors');
require('dotenv').config();

const auditRoutes = require('./routes/audit.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Routes
app.use('/api/v1', auditRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'TruthLens API',
    version: '1.0.0',
    description: 'Hallucination Audit Trail for LLM-Generated Documents'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
});

app.listen(PORT, () => {
  console.log(`\n🔍 TruthLens API running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/v1/health\n`);
});

module.exports = app;
