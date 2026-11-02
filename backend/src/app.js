import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import whatsappRouter from './routes/whatsapp.js';
import requestsRouter from './routes/requests.js';
import donorsRouter from './routes/donors.js';
import patientsRouter from './routes/patients.js';
import stockRouter from './routes/stock.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Bloodo Backend Platform',
    timestamp: new Date().toISOString(),
    clinicalDisclaimer: 'Bloodo does not independently approve donor eligibility or determine clinical transfusion compatibility.'
  });
});

// API Routes
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/donors', donorsRouter);
app.use('/api/patients', patientsRouter);
app.use('/api/stock', stockRouter);

// Serve frontend static build if present
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) next();
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`BLOODO Server running on http://localhost:${PORT}`);
  });
}

export default app;
