import type { IncomingMessage, ServerResponse } from "node:http";
import type { json, readBody } from "../harness/http.ts";
import type { RequestAuth } from "../request-auth.ts";

/** "Not my route": the next handler, then index.ts's inline routes, get a turn. */
export const PASS: unique symbol = Symbol("route.pass");

/** What a route module starts with. Anything else it needs (store, config,
 * managers) is passed explicitly to its factory, never reached for here. */
export interface RouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  /** `url.pathname` */
  path: string;
  method: string;
  auth: RequestAuth;
  json: typeof json;
  readBody: typeof readBody;
}

/** Resolve with PASS to decline; anything else means the request was answered. */
export type RouteHandler = (ctx: RouteContext) => Promise<typeof PASS | void>;
