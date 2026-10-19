import { CheckIcon, ChevronsUpDownIcon, UserRoundIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useBrowseScope } from "@/hooks/useBrowseScope";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useAllUserStats, useUsersByNames } from "@/hooks/useUserQueries";
import { buildBrowseSearch } from "@/lib/browse-scope";
import { ROUTES } from "@/router/routes";
import { State } from "@/types/proto/api/v1/common_pb";
import { useTranslate } from "@/utils/i18n";

export default function CreatorSelector() {
  const t = useTranslate();
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const { creator, isOwn, isMixed } = useBrowseScope();
  const { data: stats = [] } = useAllUserStats({ state: State.NORMAL });
  const names = stats.map((stat) => stat.name.replace(/\/stats$/, ""));
  const { data: users } = useUsersByNames(names);
  const label = isMixed ? t("browse.all") : isOwn ? t("browse.mine") : users?.get(`users/${creator}`)?.displayName || creator;
  const select = (username?: string) =>
    navigate({
      pathname: location.pathname.startsWith("/u/") ? ROUTES.HOME : location.pathname,
      search: buildBrowseSearch(location.search, username),
    });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("browse.choose")}
        className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-sidebar-accent"
      >
        <UserRoundIcon className="size-4" />
        <span className="min-w-0 flex-1 truncate text-start">{label}</span>
        <ChevronsUpDownIcon className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-60 overflow-y-auto">
        <DropdownMenuItem onClick={() => select()}>
          {t("browse.all")}
          {isMixed && <CheckIcon className="ml-auto size-4" />}
        </DropdownMenuItem>
        {currentUser && (
          <DropdownMenuItem onClick={() => select(currentUser.username)}>
            {t("browse.mine")}
            {isOwn && <CheckIcon className="ml-auto size-4" />}
          </DropdownMenuItem>
        )}
        {names
          .filter((name) => name !== currentUser?.name)
          .map((name) => {
            const username = name.slice("users/".length);
            const user = users?.get(name);
            return (
              <DropdownMenuItem key={name} onClick={() => select(username)}>
                <span className="truncate">{user?.displayName || username}</span>
                <span className="ml-auto text-xs text-muted-foreground">@{username}</span>
                {username === creator && <CheckIcon className="size-4" />}
              </DropdownMenuItem>
            );
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
