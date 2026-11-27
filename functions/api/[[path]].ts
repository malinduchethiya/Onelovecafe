import worker, { WorkerEnv } from '../../src/worker';

interface PagesFunctionContext {
  request: Request;
  env: WorkerEnv;
}

export async function onRequest(context: PagesFunctionContext): Promise<Response> {
  return worker.fetch(context.request, context.env);
}
