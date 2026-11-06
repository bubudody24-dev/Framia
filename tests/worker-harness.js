// Local integration harness. Never include this entrypoint in deploy.json.
import { api } from '../worker.js';

export default {
  fetch(request, env) {
    const sub = request.headers.get('x-test-user');
    return api(request, env, { getUser: async () => sub ? { sub } : null });
  },
};
