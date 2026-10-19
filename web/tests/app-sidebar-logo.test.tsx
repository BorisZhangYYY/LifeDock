import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, screen, render as testingLibraryRender } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppSidebar, { MobileAppHeader, MobileAppSidebar } from "@/components/AppSidebar";
import { SIDEBAR_SECTION_ACTION_BUTTON_CLASSES, SIDEBAR_SECTION_ACTION_ICON_CLASSES } from "@/components/AppSidebar/SidebarSection";

const authState = vi.hoisted(() => ({
  currentUser: { name: "users/test" } as { name: string } | undefined,
  memoViews: [] as Array<{ name: string; title: string }>,
  notifications: [] as Array<{ status: number }>,
}));
const sidebarState = vi.hoisted(() => ({
  memoScope: "home" as "home" | "explore",
  mobileOpen: false,
}));
const globalEditorState = vi.hoisted(() => ({
  canOpen: true,
  openEditor: vi.fn(),
}));
const spaceState = vi.hoisted(() => ({
  spaces: [] as Array<{ name: string; title: string; description: string }>,
  selectedSpace: undefined as { name: string; title: string; description: string } | undefined,
  selectedSpaceName: undefined as string | undefined,
  memoFilter: undefined as string | undefined,
  clearSelectedSpace: vi.fn(),
  selectMemos: vi.fn(),
  selectSpace: vi.fn(),
}));
const filteredStatsHook = vi.hoisted(() => vi.fn());
const tagsSectionHook = vi.hoisted(() => vi.fn());

vi.mock("@/components/MemosLogo", () => ({
  default: () => <span>Memos logo</span>,
}));

vi.mock("@/components/MemoDisplaySettingMenu", () => ({
  default: () => <button type="button">memo.view-options</button>,
}));

vi.mock("@/components/UserMenu", () => ({
  default: () => (
    <button type="button" className="w-full">
      User menu
    </button>
  ),
}));

vi.mock("@/components/CreateSpaceDialog", () => ({
  default: () => null,
}));

vi.mock("@/components/StatisticsView", () => ({
  default: () => <div>Calendar</div>,
}));

vi.mock("@/components/AppSidebar/TagsSection", () => ({
  default: (props: unknown) => {
    tagsSectionHook(props);
    return <div>Tags</div>;
  },
}));

vi.mock("@/contexts/AppSidebarContext", () => ({
  useAppSidebar: () => ({
    attachmentSection: "all",
    setAttachmentSection: vi.fn(),
    inboxFilter: "all",
    setInboxFilter: vi.fn(),
    memoDetail: undefined,
    setMemoDetail: vi.fn(),
    mobileOpen: sidebarState.mobileOpen,
    setMobileOpen: vi.fn(),
    quickFindOpen: false,
    setQuickFindOpen: vi.fn(),
    memoScope: sidebarState.memoScope,
    setMemoScope: vi.fn(),
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isInitialized: true, isUserSettingsInitialized: true }),
}));

vi.mock("@/contexts/GlobalMemoEditorContext", () => ({
  useGlobalMemoEditor: () => globalEditorState,
}));

vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => ({ isInitialized: true }),
}));

vi.mock("@/contexts/MemoFilterContext", () => ({
  getFilterSearch: () => "",
  stringifyFilters: () => "",
  replaceFiltersByFactor: (filters: unknown[]) => filters,
  useMemoFilterContext: () => ({
    filters: [],
    memoView: undefined,
    setMemoView: vi.fn(),
  }),
}));

vi.mock("@/contexts/SpaceContext", () => ({
  useSpaceContext: () => {
    const duplicateSpaceTitles = new Set(
      spaceState.spaces
        .filter((space, index) => spaceState.spaces.findIndex((candidate) => candidate.title === space.title) !== index)
        .map((space) => space.title),
    );
    return {
      ...spaceState,
      duplicateSpaceTitles,
      isLoadingSpaces: false,
      isSpacesError: false,
    };
  },
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => authState.currentUser,
}));

vi.mock("@/hooks/useFilteredMemoStats", () => ({
  useFilteredMemoStats: (options: unknown) => {
    filteredStatsHook(options);
    return { statistics: { activityStats: {}, timeBasis: "create_time" }, tags: {} };
  },
}));

vi.mock("@/hooks/useAttachmentLibrary", () => ({
  useAttachmentLibraryStats: () => ({ stats: { media: 0, documents: 0, audio: 0, unused: 0 } }),
}));

vi.mock("@/hooks/useMediaQuery", () => ({
  default: () => true,
}));

vi.mock("@/hooks/useUserQueries", () => ({
  userKeys: {
    memoViews: (parent?: string) => ["users", "memoViews", parent],
  },
  useMemoViews: () => ({ data: authState.memoViews }),
  useAllUserStats: () => ({ data: [] }),
  useUsersByNames: () => ({ data: new Map() }),
  useNotifications: () => ({ data: authState.notifications }),
  useUser: () => ({ data: undefined }),
}));

vi.mock("@/i18n", () => ({
  default: { language: "en" },
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

const render = (ui: Parameters<typeof testingLibraryRender>[0]) =>
  testingLibraryRender(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>,
  );

describe("App sidebar logo", () => {
  beforeEach(() => {
    authState.currentUser = { name: "users/test" };
    authState.memoViews = [];
    authState.notifications = [];
    sidebarState.memoScope = "home";
    sidebarState.mobileOpen = false;
    globalEditorState.canOpen = true;
    globalEditorState.openEditor.mockClear();
    spaceState.spaces = [];
    spaceState.selectedSpace = undefined;
    spaceState.selectedSpaceName = undefined;
    spaceState.memoFilter = undefined;
    spaceState.clearSelectedSpace.mockClear();
    spaceState.selectMemos.mockClear();
    spaceState.selectSpace.mockClear();
    filteredStatsHook.mockClear();
    tagsSectionHook.mockClear();
  });

  it("shows the context switcher and opens the global memo editor", () => {
    render(
      <MemoryRouter initialEntries={["/attachments"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "space.switch: common.memos" })).toHaveTextContent("Memos logo");
    fireEvent.click(screen.getByRole("button", { name: "editor.new-memo" }));
    expect(globalEditorState.openEditor).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "common.calendar" })).toBeInTheDocument();
  });

  it.each([
    "/",
    "/explore",
    "/attachments",
    "/Explore/",
    "/Attachments/",
  ])("shows the selected Space only on collection route %s", (path) => {
    const product = { name: "spaces/product", title: "Product", description: "" };
    spaceState.spaces = [product];
    spaceState.selectedSpace = product;
    spaceState.selectedSpaceName = product.name;
    spaceState.memoFilter = 'space == "spaces/product"';

    render(
      <MemoryRouter initialEntries={[path]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "space.switch: Product" })).toBeInTheDocument();
  });

  it.each([
    "/archived",
    "/inbox",
    "/u/alice",
    "/setting",
    "/about",
    "/views",
    "/memos/123",
    "/memos/shares/token",
    "/404",
  ])("uses the instance brand instead of the remembered Space on %s", (path) => {
    const product = { name: "spaces/product", title: "Product", description: "" };
    spaceState.spaces = [product];
    spaceState.selectedSpace = product;
    spaceState.selectedSpaceName = product.name;
    spaceState.memoFilter = 'space == "spaces/product"';

    render(
      <MemoryRouter initialEntries={[path]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "common.memos", expanded: false })).toHaveTextContent("Memos logo");
    expect(screen.queryByRole("button", { name: /^space\.switch:/ })).not.toBeInTheDocument();
  });

  it("scopes collection statistics to the selected Space", () => {
    spaceState.selectedSpaceName = "spaces/product";
    spaceState.memoFilter = 'space == "spaces/product"';

    render(
      <MemoryRouter initialEntries={["/explore"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(filteredStatsHook).toHaveBeenCalledWith(expect.objectContaining({ context: "collection", filter: 'space == "spaces/product"' }));
  });

  it("includes authorized Space memos in All Explore statistics", () => {
    render(
      <MemoryRouter initialEntries={["/explore"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(filteredStatsHook).toHaveBeenCalledWith(expect.objectContaining({ context: "collection", filter: undefined }));
  });

  it("keeps Profile statistics and tag UI state independent of the remembered Space", () => {
    spaceState.selectedSpaceName = "spaces/product";
    spaceState.memoFilter = 'space == "spaces/product"';

    render(
      <MemoryRouter initialEntries={["/u/alice"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(filteredStatsHook).toHaveBeenCalledWith(expect.objectContaining({ context: "profile", filter: undefined }));
    expect(tagsSectionHook).toHaveBeenCalledWith(expect.objectContaining({ scope: "profile" }));
  });

  it("keeps Archived statistics and tag UI state independent of the remembered Space", () => {
    spaceState.selectedSpaceName = "spaces/product";
    spaceState.memoFilter = 'space == "spaces/product"';

    render(
      <MemoryRouter initialEntries={["/archived"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(filteredStatsHook).toHaveBeenCalledWith(expect.objectContaining({ context: "archived", filter: undefined }));
    expect(tagsSectionHook).toHaveBeenCalledWith(expect.objectContaining({ scope: "archived" }));
  });

  it("uses one unified signed-in footer surface", () => {
    render(
      <MemoryRouter initialEntries={["/inbox"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    const footer = screen.getByRole("button", { name: "User menu" }).closest("footer");
    expect(footer).not.toBeNull();
    expect(footer?.childElementCount).toBe(1);
    expect(screen.queryByRole("link", { name: /^common\.inbox/ })).not.toBeInTheDocument();
  });

  it("keeps Attachments active after route normalization", () => {
    render(
      <MemoryRouter initialEntries={["/Attachments/"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "common.attachments" })).toHaveAttribute("aria-current", "page");
  });

  it("hides the instance-level unused attachment collection in a Space", () => {
    spaceState.selectedSpaceName = "spaces/product";
    spaceState.memoFilter = 'space == "spaces/product"';

    render(
      <MemoryRouter initialEntries={["/attachments"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "attachment-library.labels.unused" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "attachment-library.tabs.media" })).toBeInTheDocument();
  });

  it("hides Compose when the composer reports it is not available", () => {
    globalEditorState.canOpen = false;
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "editor.new-memo" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.search" })).toBeInTheDocument();
  });

  it("shows the compact public navigation for a guest", () => {
    authState.currentUser = undefined;
    globalEditorState.canOpen = false;
    render(
      <MemoryRouter initialEntries={["/explore"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Memos logo" })).toHaveAttribute("href", "/explore");
    expect(screen.queryByRole("button", { name: /^space\.switch:/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "common.explore" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "common.about" })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: "common.sign-in-to-memos" }).closest("footer")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "editor.new-memo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "common.timeline" })).not.toBeInTheDocument();
  });

  it("does not inherit collection content on a route without a collection", () => {
    render(
      <MemoryRouter initialEntries={["/404"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Calendar")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "common.statistics" })).not.toBeInTheDocument();
    expect(screen.queryByText("common.views")).not.toBeInTheDocument();
    expect(screen.queryByText("Tags")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.memos", expanded: false })).toHaveTextContent("Memos logo");
    expect(screen.getByRole("link", { name: "common.attachments" })).toHaveAttribute("href", "/attachments?creator=test");
    expect(screen.queryByRole("link", { name: "common.inbox" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "common.timeline" })).toHaveAttribute("href", "/?creator=test");
    expect(screen.queryByRole("link", { name: "common.about" })).not.toBeInTheDocument();
    expect(screen.getByText("User menu").closest("footer")).not.toBeNull();
  });

  it("uses a visitor sidebar for a guest on a route without contextual content", () => {
    authState.currentUser = undefined;
    render(
      <MemoryRouter initialEntries={["/404"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "common.explore" })).toHaveAttribute("href", "/explore?creator=all");
    expect(screen.queryByRole("link", { name: "common.timeline" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "common.attachments" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "common.inbox" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "common.about" })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: "common.sign-in-to-memos" }).closest("footer")).not.toBeNull();
  });

  it.each(["/about", "/About/"])("marks About active for a guest on %s", (path) => {
    authState.currentUser = undefined;
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "common.about" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByText("Calendar")).not.toBeInTheDocument();
  });

  it("keeps display options in primary navigation and collection links in the Memos menu", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    const primary = screen.getByRole("navigation", { name: "Primary" });
    expect(primary).toContainElement(screen.getByRole("link", { name: "common.timeline" }));
    expect(primary).toContainElement(screen.getByRole("button", { name: "memo.view-options" }));
    expect(primary).toContainElement(screen.getByRole("link", { name: "common.attachments" }));
    expect(primary).not.toContainElement(screen.getByRole("button", { name: "common.tasks" }));
    const createView = screen.getByRole("button", { name: "common.create" });
    expect(createView).toHaveClass(...SIDEBAR_SECTION_ACTION_BUTTON_CLASSES.split(" "));
    expect(createView.querySelector("svg")).toHaveClass(SIDEBAR_SECTION_ACTION_ICON_CLASSES);
    const calendar = screen.getByText("Calendar");
    const views = screen.getByText("common.views");
    expect(calendar.compareDocumentPosition(views) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "space.switch: common.memos" }));
    expect(await screen.findByRole("menuitem", { name: "common.timeline" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "common.explore" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "common.archived" })).toBeInTheDocument();
  });

  it.each([
    ["/reminders", "common.reminders"],
    ["/finance", "personal.finance"],
    ["/mood", "personal.mood"],
  ])("keeps personal navigation available without memo filters on %s", (path, label) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    const personal = screen.getByRole("link", { name: "personal.navigation" });
    expect(personal).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("navigation", { name: "Primary" })).toContainElement(personal);
    expect(screen.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "personal.navigation" })).toBeInTheDocument();
    expect(screen.queryByText("Calendar")).not.toBeInTheDocument();
    expect(screen.queryByText("Tags")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "common.attachments" })).toBeInTheDocument();
  });

  it("uses compact text-only actions for a saved view", async () => {
    authState.memoViews = [{ name: "memoViews/1", title: "testgp" }];
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "common.edit testgp" }));

    const menu = await screen.findByRole("menu");
    expect(menu).toHaveAttribute("data-size", "sm");
    expect(menu).toHaveClass("min-w-24", "p-0.5");
    const editItem = screen.getByRole("menuitem", { name: "common.edit" });
    const deleteItem = screen.getByRole("menuitem", { name: "common.delete" });
    expect(editItem.querySelector("svg")).toBeNull();
    expect(deleteItem.querySelector("svg")).toBeNull();
    expect(deleteItem).toHaveAttribute("data-variant", "destructive");
  });

  it("keeps five primary destinations and shows Attachments in the content rail", () => {
    render(
      <MemoryRouter initialEntries={["/attachments"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    const primary = screen.getByRole("navigation", { name: "Primary" });
    const attachments = screen.getByRole("link", { name: "common.attachments" });
    expect(attachments).toHaveAttribute("aria-current", "page");
    expect(primary).toContainElement(attachments);
    expect(primary.querySelectorAll("a")).toHaveLength(5);
    expect(primary).not.toContainElement(screen.getByRole("button", { name: "common.search" }));
    expect(screen.getByRole("link", { name: "personal.navigation" })).toHaveAttribute("href", "/personal");
    expect(screen.getByRole("button", { name: "User menu" }).closest("footer")).not.toBeNull();

    fireEvent.click(screen.getByRole("link", { name: "common.timeline" }));
    expect(screen.getByRole("link", { name: "common.timeline" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Calendar")).toBeInTheDocument();
  });

  it("opens the personal section from its primary destination and selects a module", () => {
    render(
      <MemoryRouter initialEntries={["/attachments"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("link", { name: "personal.navigation" }));
    expect(screen.getByRole("heading", { name: "personal.navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "common.reminders" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "personal.finance" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "personal.mood" }));
    expect(screen.getByRole("link", { name: "personal.mood" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "personal.navigation" })).toHaveAttribute("aria-current", "page");
  });

  it.each([
    ["/attachments", "common.attachments"],
    ["/inbox", "common.inbox"],
    ["/setting", "common.basic"],
    ["/u/test", "common.profile"],
  ])("labels the sidebar content section on %s", (path, label) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: label, level: 2 })).toBeInTheDocument();
  });

  it("keeps Explore accessible through the Memos menu from a global destination", async () => {
    sidebarState.memoScope = "explore";
    render(
      <MemoryRouter initialEntries={["/inbox"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "common.memos" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "common.explore" }));
    expect(screen.getByRole("link", { name: "common.timeline" })).toHaveAttribute("aria-current", "page");
    expect(filteredStatsHook).toHaveBeenCalledWith(expect.objectContaining({ context: "collection" }));
  });

  it("returns from Archived to the personal timeline", () => {
    sidebarState.memoScope = "explore";
    render(
      <MemoryRouter initialEntries={["/archived"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("link", { name: "common.timeline" }));
    expect(screen.getByRole("link", { name: "common.timeline" })).toHaveAttribute("href", "/?creator=test");
    expect(filteredStatsHook).toHaveBeenCalledWith(expect.objectContaining({ context: "profile" }));
  });

  it("keeps the mobile header limited to navigation and context", () => {
    render(
      <MemoryRouter initialEntries={["/about"]}>
        <MobileAppHeader />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveAttribute("data-mobile-navigation-trigger");
    expect(screen.getByRole("button", { name: "common.memos", expanded: false })).toHaveTextContent("Memos logo");
    expect(screen.queryByRole("button", { name: /^space\.switch:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "common.search" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "editor.new-memo" })).not.toBeInTheDocument();
  });

  it("exposes Compose in the mobile navigation drawer", () => {
    sidebarState.mobileOpen = true;
    render(
      <MemoryRouter initialEntries={["/about"]}>
        <MobileAppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "common.search" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "editor.new-memo" }));
    expect(globalEditorState.openEditor).toHaveBeenCalledOnce();
  });
});
