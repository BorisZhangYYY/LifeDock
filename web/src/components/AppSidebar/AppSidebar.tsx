import { useDirection } from "@base-ui/react/direction-provider";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArchiveIcon,
  ArrowRightIcon,
  BellIcon,
  CalendarDaysIcon,
  ChevronsUpDownIcon,
  EarthIcon,
  FileAudioIcon,
  FileTextIcon,
  ImageIcon,
  InfoIcon,
  LayoutDashboardIcon,
  LayoutListIcon,
  LibraryIcon,
  ListIcon,
  type LucideIcon,
  MapIcon,
  MenuIcon,
  MoreHorizontalIcon,
  PaperclipIcon,
  PlusIcon,
  SearchIcon,
  SquarePenIcon,
  Trash2Icon,
  UserRoundIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link, matchPath, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import ConfirmDialog from "@/components/ConfirmDialog";
import { MemoDetailSidebar } from "@/components/MemoDetailSidebar";
import MemoDisplaySettingMenu from "@/components/MemoDisplaySettingMenu";
import MemoViewIcon from "@/components/MemoViewIcon";
import { DEFAULT_SETTING_SECTION, SETTINGS_SECTIONS } from "@/components/Settings/settingSections";
import StatisticsView from "@/components/StatisticsView";
import UserMenu from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { memoViewServiceClient } from "@/connect";
import { type AttachmentSection, type InboxFilter, useAppSidebar } from "@/contexts/AppSidebarContext";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalMemoEditor } from "@/contexts/GlobalMemoEditorContext";
import { useInstance } from "@/contexts/InstanceContext";
import { getFilterSearch, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useSpaceContext } from "@/contexts/SpaceContext";
import { useAttachmentLibraryStats } from "@/hooks/useAttachmentLibrary";
import { useBrowseScope } from "@/hooks/useBrowseScope";
import useCurrentUser from "@/hooks/useCurrentUser";
import { type MemoStatsContext, useFilteredMemoStats } from "@/hooks/useFilteredMemoStats";
import useMediaQuery from "@/hooks/useMediaQuery";
import usePersonalFeatures from "@/hooks/usePersonalFeatures";
import { useMemoViews, useNotifications, userKeys, useUser } from "@/hooks/useUserQueries";
import { buildBrowseSearch } from "@/lib/browse-scope";
import { combineCELFilters } from "@/lib/cel-filter";
import { handleError } from "@/lib/error";
import { BUILTIN_TASKS_VIEW_ID, getMemoViewId, isMemoCollectionRoute, type PrimaryMemoScope, resolveMemoScope } from "@/lib/memo-views";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/router/routes";
import { State } from "@/types/proto/api/v1/common_pb";
import type { MemoView } from "@/types/proto/api/v1/memo_view_service_pb";
import { User_Role, UserNotification_Status, UserNotification_Type } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import MemosLogo from "../MemosLogo";
import CreatorSelector from "./CreatorSelector";
import MoodFilterSection from "./MoodFilterSection";
import PersonalNavigation from "./PersonalNavigation";
import { getSidebarRouteKind, routeSupportsCollectionScope } from "./routes";
import SidebarRow, { SIDEBAR_ROW_CLASSES, SIDEBAR_ROW_FOCUS_CLASSES, SIDEBAR_ROW_ICON_CLASSES, sidebarRowStateClasses } from "./SidebarRow";
import SidebarSection, {
  SIDEBAR_SECTION_ACTION_BUTTON_CLASSES,
  SIDEBAR_SECTION_ACTION_ICON_CLASSES,
  SIDEBAR_SECTION_STACK_CLASSES,
} from "./SidebarSection";
import SpaceSwitcher from "./SpaceSwitcher";
import TagsSection from "./TagsSection";

const SIDEBAR_HORIZONTAL_PADDING = "px-3";
const SIDEBAR_HEADER_ACTION_CLASSES = "size-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground";

const NewMemoAction = ({ onClick }: { onClick: () => void }) => {
  const t = useTranslate();
  const label = t("editor.new-memo");

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={SIDEBAR_HEADER_ACTION_CLASSES}
            onClick={onClick}
            aria-label={label}
            data-new-memo-trigger
          />
        }
      >
        <SquarePenIcon className="size-4" strokeWidth={1.8} />
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
};

const ViewsSection = ({ manageActive = false }: { manageActive?: boolean }) => {
  const t = useTranslate();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const queryClient = useQueryClient();
  const { data: memoViews = [] } = useMemoViews(currentUser?.name);
  const { memoView: selectedMemoView, setMemoView } = useMemoFilterContext();
  const { setMobileOpen } = useAppSidebar();
  const [deleteTarget, setDeleteTarget] = useState<MemoView>();
  const location = useLocation();
  const browse = useBrowseScope();

  const handleView = (viewId: string) => {
    setMemoView(selectedMemoView === viewId ? undefined : viewId);
    if (!isMemoCollectionRoute(location.pathname)) navigate({ pathname: ROUTES.HOME, search: browse.search });
    setMobileOpen(false);
  };

  const handleCreate = () => {
    navigate(ROUTES.VIEWS, { state: { openCreate: true } });
    setMobileOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await memoViewServiceClient.deleteMemoView({ name: deleteTarget.name });
      await queryClient.invalidateQueries({ queryKey: userKeys.memoViews(currentUser?.name) });
      if (selectedMemoView === getMemoViewId(deleteTarget.name)) setMemoView(undefined);
      toast.success(t("setting.memo-view.delete-success", { title: deleteTarget.title }));
    } catch (error: unknown) {
      handleError(error, toast.error, { context: "Delete memo view" });
    } finally {
      setDeleteTarget(undefined);
    }
  };

  return (
    <SidebarSection
      label={t("common.views")}
      action={
        !manageActive && (
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              className={SIDEBAR_SECTION_ACTION_BUTTON_CLASSES}
              onClick={handleCreate}
              aria-label={t("common.create")}
            >
              <PlusIcon className={SIDEBAR_SECTION_ACTION_ICON_CLASSES} strokeWidth={1.8} />
            </Button>
          </div>
        )
      }
    >
      <SidebarRow
        active={!manageActive && selectedMemoView === BUILTIN_TASKS_VIEW_ID}
        label={t("common.tasks")}
        onClick={() => handleView(BUILTIN_TASKS_VIEW_ID)}
      />
      {memoViews.map((memoView) => {
        const id = getMemoViewId(memoView.name);
        const active = !manageActive && selectedMemoView === id;
        return (
          <div key={memoView.name} className={cn(SIDEBAR_ROW_CLASSES, "group/view", sidebarRowStateClasses(active))}>
            <button
              type="button"
              onClick={() => handleView(id)}
              aria-pressed={active || undefined}
              className="flex h-full min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <MemoViewIcon icon={memoView.icon} className="size-4" />
              <span className="min-w-0 flex-1 truncate">{memoView.title}</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                nativeButton={false}
                render={
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`${t("common.edit")} ${memoView.title}`}
                    className="-mr-1 flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-opacity hover:bg-background/70 md:opacity-0 md:group-hover/view:opacity-100 md:focus-visible:opacity-100 data-popup-open:opacity-100"
                  />
                }
              >
                <MoreHorizontalIcon className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={2} size="sm">
                <DropdownMenuItem
                  onClick={() => {
                    navigate(ROUTES.VIEWS, { state: { memoView } });
                    setMobileOpen(false);
                  }}
                >
                  {t("common.edit")}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(memoView)}>
                  {t("common.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
      {manageActive && <SidebarRow active icon={MoreHorizontalIcon} label={t("common.manage")} />}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t("setting.memo-view.delete-confirm", { title: deleteTarget?.title ?? "" })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={handleDelete}
        confirmVariant="destructive"
      />
    </SidebarSection>
  );
};

const ProfileMode = () => {
  const t = useTranslate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setMobileOpen } = useAppSidebar();
  const active = searchParams.get("view") === "map" ? "map" : "memos";
  const setMode = (mode: "memos" | "map") => {
    setSearchParams((params) => {
      mode === "map" ? params.set("view", "map") : params.delete("view");
      return params;
    });
    setMobileOpen(false);
  };

  return (
    <SidebarSection label={t("common.profile")}>
      <SidebarRow active={active === "memos"} icon={LayoutListIcon} label={t("common.memos")} onClick={() => setMode("memos")} />
      <SidebarRow active={active === "map"} icon={MapIcon} label={t("common.map")} onClick={() => setMode("map")} />
    </SidebarSection>
  );
};

const CollectionSidebarContent = ({ context }: { context: MemoStatsContext }) => {
  const t = useTranslate();
  const location = useLocation();
  const currentUser = useCurrentUser();
  const browse = useBrowseScope();
  const { memoFilter, selectedSpaceName } = useSpaceContext();
  const md = useMediaQuery("md");
  const { mobileOpen, setMobileOpen } = useAppSidebar();
  const { moodEnabled } = usePersonalFeatures();
  const { isInitialized: authInitialized } = useAuth();
  const { isInitialized: instanceInitialized } = useInstance();
  const profileMatch = matchPath("/u/:username", location.pathname);
  const { data: profileUser } = useUser(profileMatch?.params.username ? `users/${profileMatch.params.username}` : "", {
    enabled: context === "profile" && !!profileMatch?.params.username,
  });
  const statsUserName =
    context === "home" || context === "explore" ? browse.creatorName : context === "profile" ? profileUser?.name : undefined;
  // User-level collections stay aligned with their unscoped feeds even when a Space is remembered.
  const isUserLevelCollection = context === "profile" || context === "archived";
  const statsFilter = isUserLevelCollection ? undefined : memoFilter;
  const { statistics, tags, dailyMoodStats } = useFilteredMemoStats({
    context: context === "home" || context === "explore" ? (statsUserName ? "profile" : "collection") : context,
    userName: statsUserName,
    filter: statsFilter,
    enabled: authInitialized && instanceInitialized && (md || mobileOpen),
  });

  const showViews = !!currentUser && (context === "home" || context === "archived" || context === "explore");
  const showMood = moodEnabled && (!browse.creatorName || browse.isOwn);

  // Off the collection routes (the library shown as fallback content), calendar and tag
  // clicks must land somewhere that renders the filtered feed.
  const onCollectionRoute = isMemoCollectionRoute(location.pathname) || !!profileMatch;
  const filterTarget = onCollectionRoute ? undefined : context === "explore" ? ROUTES.EXPLORE : ROUTES.HOME;
  const tagStateScope = isUserLevelCollection
    ? (statsUserName ?? context)
    : `${statsUserName ?? context}${selectedSpaceName ? `:${selectedSpaceName}` : ""}`;

  return (
    <div className={SIDEBAR_SECTION_STACK_CLASSES}>
      {context === "profile" && <ProfileMode />}
      <SidebarSection ariaLabel={t("common.statistics")}>
        <StatisticsView
          statisticsData={statistics}
          dailyMoodStats={showMood ? dailyMoodStats : undefined}
          navigationTarget={filterTarget}
          onDateSelect={() => setMobileOpen(false)}
        />
      </SidebarSection>
      {showMood && <MoodFilterSection navigationTarget={filterTarget} onSelect={() => setMobileOpen(false)} />}
      {showViews && <ViewsSection />}
      <TagsSection tagCount={tags} navigationTarget={filterTarget} scope={tagStateScope} onSelect={() => setMobileOpen(false)} />
    </div>
  );
};

const AttachmentsSidebarContent = () => {
  const t = useTranslate();
  const { memoFilter, selectedSpaceName } = useSpaceContext();
  const { creatorFilter, isOwn } = useBrowseScope();
  const { attachmentSection, setAttachmentSection, setMobileOpen } = useAppSidebar();
  const { isComplete, stats } = useAttachmentLibraryStats(combineCELFilters(memoFilter, creatorFilter));
  const total = stats.media + stats.documents + stats.audio;
  const rows: Array<{ value: AttachmentSection; icon: LucideIcon; label: string; count?: number }> = [
    { value: "all", icon: ListIcon, label: t("common.all"), count: isComplete ? total : undefined },
    { value: "media", icon: ImageIcon, label: t("attachment-library.tabs.media"), count: isComplete ? stats.media : undefined },
    { value: "audio", icon: FileAudioIcon, label: t("attachment-library.tabs.audio"), count: isComplete ? stats.audio : undefined },
    {
      value: "documents",
      icon: FileTextIcon,
      label: t("attachment-library.tabs.documents"),
      count: isComplete ? stats.documents : undefined,
    },
  ];
  // Unlinked uploads do not belong to any Space, so "Unused" is only a Memos-level collection.
  if (!selectedSpaceName && isOwn) {
    rows.push({
      value: "unused",
      icon: Trash2Icon,
      label: t("attachment-library.labels.unused"),
      count: isComplete ? stats.unused : undefined,
    });
  }
  return (
    <SidebarSection label={t("common.attachments")}>
      {rows.map((row) => (
        <SidebarRow
          key={row.value}
          active={attachmentSection === row.value}
          icon={row.icon}
          label={row.label}
          count={row.count}
          onClick={() => {
            setAttachmentSection(row.value);
            setMobileOpen(false);
          }}
        />
      ))}
    </SidebarSection>
  );
};

const InboxSidebarContent = () => {
  const t = useTranslate();
  const { inboxFilter, setInboxFilter, setMobileOpen } = useAppSidebar();
  const { data: notifications = [] } = useNotifications();
  const { remindersEnabled } = usePersonalFeatures();
  const visibleNotifications = remindersEnabled
    ? notifications
    : notifications.filter((notification) => notification.type !== UserNotification_Type.REMINDER);
  const rows: Array<{ value: InboxFilter; icon: LucideIcon; label: string; count: number }> = [
    {
      value: "all",
      icon: ListIcon,
      label: t("common.all"),
      count: visibleNotifications.filter((item) => item.status !== UserNotification_Status.ARCHIVED).length,
    },
    {
      value: "unread",
      icon: BellIcon,
      label: t("inbox.unread"),
      count: visibleNotifications.filter((item) => item.status === UserNotification_Status.UNREAD).length,
    },
    {
      value: "archived",
      icon: ArchiveIcon,
      label: t("common.archived"),
      count: visibleNotifications.filter((item) => item.status === UserNotification_Status.ARCHIVED).length,
    },
  ];
  return (
    <SidebarSection label={t("common.inbox")}>
      {rows.map((row) => (
        <SidebarRow
          key={row.value}
          active={inboxFilter === row.value}
          icon={row.icon}
          label={row.label}
          count={row.count}
          onClick={() => {
            setInboxFilter(row.value);
            setMobileOpen(false);
          }}
        />
      ))}
    </SidebarSection>
  );
};

const SettingsSidebarContent = () => {
  const t = useTranslate();
  const location = useLocation();
  const user = useCurrentUser();
  const { setMobileOpen } = useAppSidebar();
  const isHost = user?.role === User_Role.ADMIN;
  const currentSection = location.hash.slice(1) || DEFAULT_SETTING_SECTION;
  const basic = SETTINGS_SECTIONS.filter((section) => section.scope === "basic");
  const admin = SETTINGS_SECTIONS.filter((section) => section.scope === "admin");
  const renderSections = (sections: typeof SETTINGS_SECTIONS) =>
    sections.map((section) => (
      <Link
        key={section.key}
        to={`${ROUTES.SETTING}#${section.key}`}
        onClick={() => setMobileOpen(false)}
        className={cn(SIDEBAR_ROW_CLASSES, sidebarRowStateClasses(currentSection === section.key))}
      >
        <section.icon className={SIDEBAR_ROW_ICON_CLASSES} strokeWidth={1.8} />
        <span className="truncate">{t(section.labelKey)}</span>
      </Link>
    ));
  return (
    <div className={SIDEBAR_SECTION_STACK_CLASSES}>
      <SidebarSection label={t("common.basic")}>{renderSections(basic)}</SidebarSection>
      {isHost && <SidebarSection label={t("common.admin")}>{renderSections(admin)}</SidebarSection>}
    </div>
  );
};

const MemoDetailSidebarContent = () => {
  const { memoDetail } = useAppSidebar();
  if (!memoDetail) return null;
  return (
    <MemoDetailSidebar
      memo={memoDetail.memo}
      parentPage={memoDetail.from}
      parentScope={memoDetail.fromScope}
      forceReadonly={memoDetail.readonly}
      contentHidden={memoDetail.contentHidden}
      onShareImageOpen={memoDetail.onShareImageOpen}
      className="pb-2"
    />
  );
};

const RouteSidebarContent = () => {
  const location = useLocation();
  const kind = getSidebarRouteKind(location.pathname);
  if (kind === "home" || kind === "archived" || kind === "explore" || kind === "profile" || kind === "calendar" || kind === "map") {
    return <CollectionSidebarContent context={kind === "calendar" || kind === "map" ? "home" : kind} />;
  }
  if (kind === "views") return <ViewsSection manageActive />;
  if (kind === "attachments") return <AttachmentsSidebarContent />;
  if (kind === "personal" || kind === "reminders" || kind === "finance" || kind === "mood") return <PersonalNavigation />;
  if (kind === "inbox") return <InboxSidebarContent />;
  if (kind === "settings") return <SettingsSidebarContent />;
  if (kind === "memo") return <MemoDetailSidebarContent />;
  return null;
};

const CollectionNavigationItems = () => {
  const t = useTranslate();
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const { filters } = useMemoFilterContext();
  const { setMobileOpen, setMemoScope } = useAppSidebar();
  const destinations = [
    { path: ROUTES.HOME, label: t("common.timeline"), icon: LibraryIcon, scope: "home" as const },
    { path: ROUTES.EXPLORE, label: t("common.explore"), icon: EarthIcon, scope: "explore" as const },
    { path: ROUTES.ARCHIVED, label: t("common.archived"), icon: ArchiveIcon },
  ];

  return (
    <>
      {destinations.map(({ path, label, icon: Icon, scope }) => (
        <DropdownMenuItem
          key={path}
          aria-current={location.pathname === path ? "page" : undefined}
          onClick={() => {
            if (scope) setMemoScope(scope);
            navigate({
              pathname: path,
              search: scope
                ? buildBrowseSearch(
                    getFilterSearch(filters),
                    scope === "home" ? (currentUser?.username ?? currentUser?.name.slice("users/".length)) : undefined,
                  )
                : "",
            });
            setMobileOpen(false);
          }}
        >
          <Icon className="size-4" strokeWidth={1.8} />
          {label}
        </DropdownMenuItem>
      ))}
    </>
  );
};

const GlobalNavigation = () => {
  const t = useTranslate();
  const location = useLocation();
  const currentUser = useCurrentUser();
  const browse = useBrowseScope();
  const { memoDetail, memoScope, setMemoScope, setMobileOpen } = useAppSidebar();
  const { isUserSettingsInitialized } = useAuth();
  const { remindersEnabled, financeEnabled, moodEnabled } = usePersonalFeatures();
  const { filters } = useMemoFilterContext();
  const routeKind = getSidebarRouteKind(location.pathname);
  const resolvedScope = resolveMemoScope(location.pathname, {
    currentUsername: currentUser?.username,
    detailFrom: memoDetail?.from,
    memoArchived: memoDetail?.memo.state === State.ARCHIVED,
    fallback: memoScope,
  });
  const primaryScope: PrimaryMemoScope = resolvedScope === "archived" ? memoScope : resolvedScope;
  const routeOwnsPrimaryScope =
    resolvedScope !== "archived" && (routeKind === "home" || routeKind === "explore" || routeKind === "profile" || routeKind === "memo");

  useEffect(() => {
    if (routeOwnsPrimaryScope && primaryScope !== memoScope) setMemoScope(primaryScope);
  }, [memoScope, primaryScope, routeOwnsPrimaryScope, setMemoScope]);

  const timelineActive = routeKind === "home" || routeKind === "explore";
  const timelinePath = currentUser ? ROUTES.HOME : ROUTES.EXPLORE;
  const personalActive = routeKind === "personal" || routeKind === "reminders" || routeKind === "finance" || routeKind === "mood";
  const personalEnabled = isUserSettingsInitialized && (remindersEnabled || financeEnabled || moodEnabled);
  const items = currentUser
    ? [
        ...(personalEnabled
          ? [{ path: ROUTES.PERSONAL, label: t("personal.navigation"), icon: LayoutDashboardIcon, active: personalActive }]
          : []),
        { path: ROUTES.CALENDAR, label: t("common.calendar"), icon: CalendarDaysIcon, active: routeKind === "calendar" },
        { path: ROUTES.MAP, label: t("common.map"), icon: MapIcon, active: routeKind === "map" },
        { path: ROUTES.ATTACHMENTS, label: t("common.attachments"), icon: PaperclipIcon, active: routeKind === "attachments" },
      ]
    : [{ path: ROUTES.ABOUT, label: t("common.about"), icon: InfoIcon, active: Boolean(matchPath(ROUTES.ABOUT, location.pathname)) }];

  return (
    <TooltipProvider>
      <nav className={cn("flex items-center gap-1", SIDEBAR_HORIZONTAL_PADDING)} aria-label="Primary">
        <div
          className={cn(
            "flex h-[30px] min-w-0 items-center rounded-md",
            timelineActive ? "flex-1" : "w-7 shrink-0",
            sidebarRowStateClasses(timelineActive),
          )}
        >
          <Link
            to={{ pathname: timelinePath, search: buildBrowseSearch(getFilterSearch(filters), browse.creator) }}
            onClick={() => {
              if (currentUser) setMemoScope("home");
              setMobileOpen(false);
            }}
            title={t("common.timeline")}
            aria-label={currentUser ? t("common.timeline") : t("common.explore")}
            aria-current={timelineActive ? "page" : undefined}
            className={cn("flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 text-ui", SIDEBAR_ROW_FOCUS_CLASSES)}
          >
            <LibraryIcon className="size-4 shrink-0" strokeWidth={1.8} />
            {timelineActive && <span className="truncate">{t("common.timeline")}</span>}
          </Link>
          {timelineActive && <MemoDisplaySettingMenu variant="navigation" className="w-[18px]" />}
        </div>
        {items.map(({ path, label, icon: Icon, active }) => (
          <Tooltip key={path} disabled={active}>
            <TooltipTrigger
              render={
                <Link
                  to={routeSupportsCollectionScope(path) ? { pathname: path, search: browse.search } : path}
                  onClick={() => setMobileOpen(false)}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-[30px] min-w-0 items-center justify-center rounded-md px-1.5 text-ui",
                    active ? "flex-1 gap-1.5" : "w-7 shrink-0",
                    SIDEBAR_ROW_FOCUS_CLASSES,
                    sidebarRowStateClasses(active),
                  )}
                />
              }
            >
              <Icon className="size-4 shrink-0" strokeWidth={1.8} />
              {active && <span className="truncate">{label}</span>}
            </TooltipTrigger>
            <TooltipContent side="bottom">{label}</TooltipContent>
          </Tooltip>
        ))}
      </nav>
    </TooltipProvider>
  );
};

const SidebarBrand = ({ className }: { className?: string }) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const location = useLocation();

  if (currentUser && routeSupportsCollectionScope(location.pathname)) {
    return (
      <SpaceSwitcher className={className}>
        <DropdownMenuSeparator />
        <CollectionNavigationItems />
      </SpaceSwitcher>
    );
  }
  if (currentUser) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t("common.memos")}
          data-memos-menu
          className={cn("flex h-9 min-w-0 items-center rounded-md text-start", SIDEBAR_ROW_FOCUS_CLASSES, className)}
        >
          <span className="min-w-0 flex-1 overflow-hidden">
            <MemosLogo compact />
          </span>
          <ChevronsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground/70" strokeWidth={1.8} />
        </DropdownMenuTrigger>
        <DropdownMenuContent size="sm" align="start" className="w-52">
          <CollectionNavigationItems />
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Link to={ROUTES.EXPLORE} className={cn("min-w-0 rounded-md focus-visible:outline-none", className)}>
      <MemosLogo compact />
    </Link>
  );
};

const AppSidebar = ({ className }: { className?: string }) => {
  const location = useLocation();
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const { setMobileOpen, setQuickFindOpen } = useAppSidebar();
  const { canOpen: canCompose, openEditor } = useGlobalMemoEditor();
  return (
    <aside className={cn("flex h-full w-full select-none flex-col bg-sidebar text-sidebar-foreground", className)}>
      <div className={cn("flex h-13 shrink-0 items-center justify-between gap-2", SIDEBAR_HORIZONTAL_PADDING)}>
        <SidebarBrand className="w-full flex-1" />
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            className={SIDEBAR_HEADER_ACTION_CLASSES}
            onClick={() => {
              setMobileOpen(false);
              setQuickFindOpen(true);
            }}
            aria-label={t("common.search")}
          >
            <SearchIcon className="size-4" strokeWidth={1.8} />
          </Button>
          {canCompose && <NewMemoAction onClick={openEditor} />}
        </div>
      </div>
      <GlobalNavigation />
      {routeSupportsCollectionScope(location.pathname) && (
        <div className={cn("mt-2", SIDEBAR_HORIZONTAL_PADDING)}>
          <CreatorSelector />
        </div>
      )}
      <div className="mx-3 mt-2 border-t border-border/70" />
      <div className={cn("min-h-0 flex-1 overflow-y-auto overflow-x-hidden pt-2 pb-3 [scrollbar-width:thin]", SIDEBAR_HORIZONTAL_PADDING)}>
        <RouteSidebarContent />
      </div>
      <footer className="shrink-0 border-t border-border/70">
        {currentUser ? (
          <UserMenu />
        ) : (
          <Link
            to={ROUTES.AUTH}
            onClick={() => setMobileOpen(false)}
            className="group flex h-10 w-full min-w-0 items-center justify-between gap-2 px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <UserRoundIcon className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
              <span className="truncate">{t("common.sign-in-to-memos")}</span>
            </span>
            <ArrowRightIcon
              className="size-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
              strokeWidth={1.8}
            />
          </Link>
        )}
      </footer>
    </aside>
  );
};

export const MobileAppHeader = () => {
  const { setMobileOpen } = useAppSidebar();
  return (
    <header className="sticky top-0 z-20 flex h-12 w-full items-center justify-start gap-1 border-b border-border/70 bg-background/90 px-2 backdrop-blur-md md:hidden">
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-8"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        data-mobile-navigation-trigger
      >
        <MenuIcon className="size-[18px]" />
      </Button>
      <SidebarBrand className="max-w-[12rem]" />
    </header>
  );
};

export const MobileAppSidebar = () => {
  const direction = useDirection();
  const { mobileOpen, setMobileOpen } = useAppSidebar();
  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent
        side={direction === "rtl" ? "right" : "left"}
        className="w-[min(18rem,calc(100vw-2rem))] gap-0 border-border p-0 shadow-2xl [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <AppSidebar />
      </SheetContent>
    </Sheet>
  );
};

export default AppSidebar;
