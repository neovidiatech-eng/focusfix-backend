import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { logger } from './lib/logger';

const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = '0.0.0.0';
const app = createApp();

app.listen(PORT, HOST, () => {
  logger.info(`🚀 FocusFix API Server running on http://${HOST}:${PORT}`);
  logger.info(`📖 OpenAPI Docs available on http://localhost:${PORT}/api/v1/openapi.json`);
});
