/**
 * The route loader seam. Today: parse the bundled TS data module. Later, when a real
 * trigger fires (route variants, server push, non-dev editor), this becomes a fetch of
 * schema-validated JSON — same schema, same return type, callers unchanged.
 *
 * Fails closed: a config that doesn't validate blocks session creation with readable
 * errors — a bad edit is caught before the driveway, not at slot 143.
 */
import { validateRouteConfig, type RouteConfig } from "../engine/schema/routeConfig";
import { baselineRoute } from "./route.baseline";

export function loadRoute(): { ok: true; config: RouteConfig } | { ok: false; errors: string[] } {
  return validateRouteConfig(baselineRoute);
}
