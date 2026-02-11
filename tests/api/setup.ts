import { Hono } from 'hono';
import routes from '../../src/api/routes';
import { errorHandler } from '../../src/api/middlewares/error';

export function createTestApp() {
  const app = new Hono();
  app.route('/api', routes);
  app.onError(errorHandler);
  app.get('/health', (c) =>
    c.json({ status: 'ok', timestamp: new Date().toISOString() })
  );
  return app;
}

export function jsonRequest(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
) {
  const { method = 'GET', body, headers = {} } = options;
  const init: RequestInit = { method, headers: { ...headers } };
  if (body) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)['Content-Type'] =
      'application/json';
  }
  return new Request(`http://localhost${path}`, init);
}
