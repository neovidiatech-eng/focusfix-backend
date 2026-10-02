import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { logger } from './lib/logger';

const PORT = process.env.PORT || 4000;
const app = createApp();

app.listen(PORT, () => {
  logger.info(`🚀 FocusFix API Server running on http://localhost:${PORT}`);
  logger.info(`📖 OpenAPI Docs available on http://localhost:${PORT}/api/v1/openapi.json`);
});
