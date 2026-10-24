export class HealthService {
  getHealthStatus() {
    return {
      status: 'ok',
      service: 'focusfix-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}

export const healthService = new HealthService();
