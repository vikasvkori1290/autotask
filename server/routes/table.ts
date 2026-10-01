// The route table: where new HTTP routes are registered (see README.md).
// server/index.ts runs it once per request, right after the auth gate and
// before its own inline routes, so every handler here is already authenticated.
import { createAutotaskRoutes } from "./autotask.ts";
import { PASS, type RouteContext, type RouteHandler } from "./types.ts";

export { PASS, type RouteContext, type RouteHandler };

export const ROUTES: RouteHandler[] = [createAutotaskRoutes()];

/** Runs handlers in order until one answers; true means stop routing. A
 * handler that wrote a response but returned PASS by mistake still counts as
 * answered, so the request can never reach a second handler. */
export async function dispatchRoutes(routes: readonly RouteHandler[], ctx: RouteContext): Promise<boolean> {
  for (const route of routes) {
    const out = await route(ctx);
    if (out !== PASS || ctx.res.headersSent || ctx.res.writableEnded) return true;
  }
  return false;
}
