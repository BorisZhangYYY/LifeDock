import { useLocation } from "react-router-dom";
import useCurrentUser from "@/hooks/useCurrentUser";
import { buildBrowseSearch, getBrowseCreator } from "@/lib/browse-scope";
import { buildMemoCreatorFilter } from "@/lib/resource-names";

/** Shared creator selection for Timeline, Calendar, Map, Attachments, and profile navigation. */
export function useBrowseScope() {
  const location = useLocation();
  const user = useCurrentUser();
  const currentUsername = user?.username ?? user?.name.slice("users/".length);
  const creator = getBrowseCreator(location.pathname, location.search, currentUsername);
  const creatorName = creator === undefined ? undefined : `users/${creator}`;
  return {
    creator,
    creatorName,
    creatorFilter: creatorName ? buildMemoCreatorFilter(creatorName) : creator === "" ? "false" : undefined,
    isOwn: Boolean(user && creator === currentUsername),
    isMixed: creator === undefined,
    search: buildBrowseSearch(location.search, creator),
  };
}
