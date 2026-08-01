import type { Bindings } from './config';
import { buildApp } from './app';

const app = buildApp();

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Bindings>;
