import { matchPath } from "react-router-dom";
import { ROUTES } from "@/router/routes";

/** A missing creator on a signed-in collection means the current user; `all` is explicit. */
export function getBrowseCreator(pathname: string, search: string, currentUsername?: string): string | undefined {
  const profile = matchPath("/u/:username", pathname);
  if (profile?.params.username) return profile.params.username;
  const creator = new URLSearchParams(search).get("creator");
  if (creator !== null) return creator === "all" ? undefined : creator;
  return matchPath(ROUTES.EXPLORE, pathname) ? undefined : currentUsername;
}

/** Carry collection queries between lenses without leaking resource-specific parameters. */
export function buildBrowseSearch(search: string, creator?: string): string {
  const source = new URLSearchParams(search);
  const next = new URLSearchParams();
  for (const key of ["filter", "view"]) {
    const value = source.get(key);
    if (value) next.set(key, value);
  }
  next.set("creator", creator ?? "all");
  return `?${next}`;
}
