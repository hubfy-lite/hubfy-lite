// Tiny path-based router for the public REST API.
// Each handler receives a RouteContext with:
//   - req: the original Request
//   - url: parsed URL
//   - params: path params (e.g. { id: "cust_abc" } for /v1/customers/:id)
//   - auth: resolved WorkspaceAuth (tenant_id + role)
//   - client: service-role Supabase client (RLS bypassed — tenant enforced in code)
//   - corsHeaders: to be spread on every response

import { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { WorkspaceAuth } from "../_shared/auth.ts";

export interface RouteContext {
  req: Request;
  url: URL;
  params: Record<string, string>;
  auth: WorkspaceAuth;
  client: SupabaseClient;
  corsHeaders: Record<string, string>;
}

export type RouteHandler = (ctx: RouteContext) => Promise<Response>;

export interface Route {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  pattern: string;
  handler: RouteHandler;
}

export function matchRoute(
  routes: Route[],
  method: string,
  pathname: string,
): { route: Route; params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== method) continue;
    const params = matchPath(route.pattern, pathname);
    if (params !== null) return { route, params };
  }
  return null;
}

function matchPath(
  pattern: string,
  pathname: string,
): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const p = patternParts[i];
    const v = pathParts[i];
    if (p.startsWith(":")) {
      params[p.slice(1)] = decodeURIComponent(v);
    } else if (p !== v) {
      return null;
    }
  }
  return params;
}
