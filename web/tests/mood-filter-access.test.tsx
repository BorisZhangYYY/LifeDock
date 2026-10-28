import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MoodFilterSection from "@/components/AppSidebar/MoodFilterSection";
import MemoFilters from "@/components/MemoFilters";
import { MemoFilterProvider } from "@/contexts/MemoFilterContext";
import { useBrowseScope } from "@/hooks/useBrowseScope";
import { useMemoFilters } from "@/hooks/useMemoFilters";

const auth = vi.hoisted(() => ({
  currentUser: undefined as { name: string } | undefined,
  isUserSettingsInitialized: true,
  userGeneralSetting: { disableMood: false },
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/contexts/AppSidebarContext", () => ({ useAppSidebar: () => ({ setQuickFindOpen: vi.fn() }) }));
vi.mock("@/contexts/InstanceContext", () => ({ useInstance: () => ({ memoRelatedSetting: {} }) }));
vi.mock("@/hooks/useUserQueries", () => ({ useMemoViews: () => ({ data: [] }) }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

const Harness = ({ showMoodSelector }: { showMoodSelector?: boolean }) => {
  const browse = useBrowseScope();
  const filter = useMemoFilters({ creatorName: browse.creatorName });
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="request-filter">{filter}</output>
      <output data-testid="search">{location.search}</output>
      <MemoFilters />
      {showMoodSelector && <MoodFilterSection />}
      <button type="button" onClick={() => navigate(`/?creator=other&filter=moodLevel%3A7%2CcontentSearch%3Atrip`)}>
        Other author
      </button>
    </>
  );
};

const FilteredPage = ({
  initialEntry = "/?filter=moodLevel%3A7%2CcontentSearch%3Atrip",
  showMoodSelector = false,
}: {
  initialEntry?: string;
  showMoodSelector?: boolean;
}) => (
  <MemoryRouter initialEntries={[initialEntry]}>
    <MemoFilterProvider>
      <Harness showMoodSelector={showMoodSelector} />
    </MemoFilterProvider>
  </MemoryRouter>
);

describe("mood filters in saved URLs", () => {
  beforeEach(() => {
    auth.currentUser = undefined;
    auth.isUserSettingsInitialized = true;
    auth.userGeneralSetting.disableMood = false;
  });

  it("omits anonymous mood filters from requests and chips while keeping public search", () => {
    render(<FilteredPage />);
    expect(screen.getByTestId("request-filter")).toHaveTextContent('content.contains("trip")');
    expect(screen.getByTestId("request-filter")).not.toHaveTextContent("mood_level");
    expect(screen.queryByText("mood.filter: mood.level-7")).not.toBeInTheDocument();
    expect(screen.getByText("trip")).toBeInTheDocument();
  });

  it("updates filters when the user signs in and out", () => {
    const { rerender } = render(<FilteredPage />);
    auth.currentUser = { name: "users/owner" };
    rerender(<FilteredPage />);
    expect(screen.getByTestId("request-filter")).toHaveTextContent("mood_level == 7");
    expect(screen.getByText("mood.filter: mood.level-7")).toBeInTheDocument();

    auth.currentUser = undefined;
    rerender(<FilteredPage />);
    expect(screen.getByTestId("request-filter")).not.toHaveTextContent("mood_level");
    expect(screen.queryByText("mood.filter: mood.level-7")).not.toBeInTheDocument();
  });

  it("omits saved mood filters when the user disables mood", () => {
    auth.currentUser = { name: "users/owner" };
    auth.userGeneralSetting.disableMood = true;
    render(<FilteredPage />);
    expect(screen.getByTestId("request-filter")).not.toHaveTextContent("mood_level");
    expect(screen.queryByText("mood.filter: mood.level-7")).not.toBeInTheDocument();
  });

  it("ignores a previous mood selection when switching to another author", async () => {
    auth.currentUser = { name: "users/owner" };
    render(<FilteredPage />);
    expect(screen.getByTestId("request-filter")).toHaveTextContent("mood_level == 7");
    fireEvent.click(screen.getByRole("button", { name: "Other author" }));
    await waitFor(() => expect(screen.getByTestId("request-filter")).not.toHaveTextContent("mood_level"));
    expect(screen.queryByText("mood.filter: mood.level-7")).not.toBeInTheDocument();
    expect(screen.getByTestId("request-filter")).toHaveTextContent('creator == "users/other"');
    expect(screen.getByTestId("request-filter")).toHaveTextContent('content.contains("trip")');
  });

  it("switches All authors to the current user's records when selecting a mood", async () => {
    auth.currentUser = { name: "users/owner" };
    render(<FilteredPage initialEntry="/?creator=all&view=map&filter=contentSearch%3Atrip" showMoodSelector />);
    fireEvent.click(screen.getByRole("button", { name: "mood.level-7 (7)" }));
    await waitFor(() => expect(new URLSearchParams(screen.getByTestId("search").textContent ?? "").get("creator")).toBe("owner"));
    expect(new URLSearchParams(screen.getByTestId("search").textContent ?? "").get("view")).toBe("map");
    expect(screen.getByTestId("request-filter")).toHaveTextContent('creator == "users/owner"');
    expect(screen.getByTestId("request-filter")).toHaveTextContent("mood_level == 7");
    expect(screen.getByTestId("request-filter")).toHaveTextContent('content.contains("trip")');
  });
});
