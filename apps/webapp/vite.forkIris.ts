import type { Plugin } from 'vite';
import { FORK_IRIS_PATH } from './src/modules/bridge/adapters/cctp/iris';

const SERVER_MODULE = '/test/e2e/utils/forkIris.ts';

/**
 * Dev server only: stands in for Iris on the Tenderly multichain fork, where
 * Circle never attests and Tenderly's CCTP relay is paused. Answers Iris's
 * GET /v2/messages/{sourceDomain}?transactionHash= under FORK_IRIS_PATH with
 * the burn signed by the test attesters (src/test/e2e/utils/forkIris.ts, loaded
 * on the server, so their keys never reach the page).
 */
export const forkIris = ({ l1Rpc, rpcName }: { l1Rpc: string; rpcName: string }): Plugin => ({
  name: 'fork-iris',
  apply: 'serve',
  configureServer(server) {
    let warned = false;
    server.middlewares.use(`${FORK_IRIS_PATH}/v2/messages`, async (req, res) => {
      const send = (status: number, body: unknown) => {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(body));
      };
      if (req.method !== 'GET' || !l1Rpc || !rpcName) return send(404, { error: 'Not found' });
      const url = new URL(req.url ?? '/', 'http://localhost');
      const sourceDomain = Number(url.pathname.slice(1));
      const txHash = url.searchParams.get('transactionHash') ?? '';
      try {
        const { forkIrisClients, forkIrisResponse } = await server.ssrLoadModule(SERVER_MODULE);
        const { status, body, warning } = await forkIrisResponse(
          forkIrisClients(l1Rpc, rpcName),
          sourceDomain,
          txHash
        );
        if (warning && !warned) server.config.logger.warn(warning, { timestamp: true });
        warned ||= !!warning;
        send(status, body);
      } catch {
        // Iris failing: the app keeps the bridge waiting and polls again.
        send(502, { error: 'Fork read failed' });
      }
    });
  }
});
