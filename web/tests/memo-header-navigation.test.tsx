import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoHeader from "@/components/MemoView/components/MemoHeader";
import { ReminderSchema } from "@/types/proto/api/v1/reminder_service_pb";

const state = vi.hoisted(() => ({
  creator: undefined as { username: string; displayName: string; avatarUrl: string } | undefined,
  currentUser: undefined as { name: string } | undefined,
}));

vi.mock("@/components/RelativeTime", () => ({
  default: () => <>time</>,
}));

vi.mock("@/components/MemoActionMenu", () => ({
  default: () => null,
}));

vi.mock("@/components/MemoReactionListView", () => ({
  ReactionSelector: () => null,
}));

vi.mock("@/components/UserAvatar", () => ({
  default: () => <span>avatar</span>,
}));

vi.mock("@/components/MemoView/components/MemoSpaceBadge", () => ({
  default: ({ spaceName }: { spaceName?: string }) => <span data-testid="memo-space">{spaceName}</span>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children, render }: { children?: React.ReactNode; render?: React.ReactNode }) => <>{render || children}</>,
  TooltipContent: () => null,
}));

vi.mock("@/contexts/NewMemoContext", () => ({
  useNewMemo: () => ({ newMemoName: undefined }),
}));

vi.mock("@/i18n", () => ({
  default: { language: "en" },
}));

vi.mock("@/components/MemoView/hooks", () => ({
  useMemoActions: () => ({ unpinMemo: vi.fn() }),
}));

vi.mock("@/components/MemoView/MemoViewContext", () => ({
  useMemoViewContext: () => ({
    memo: { name: "memos/123", creator: "users/demo", visibility: 1, pinned: false, space: "spaces/product" },
    creator: state.creator,
    currentUser: state.currentUser,
    parentPage: "/explore?filter=tagSearch%3Awork",
    parentScope: "preserve",
    isArchived: false,
    readonly: false,
    openEditor: vi.fn(),
  }),
  useMemoViewDerived: () => ({
    createTime: new Date("2026-08-26T00:00:00Z"),
    updateTime: undefined,
    displayTime: new Date("2026-08-26T00:00:00Z"),
    isDisplayingUpdatedTime: false,
    relativeTimeFormat: "auto",
  }),
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

const LocationProbe = () => {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}|{JSON.stringify(location.state)}
    </output>
  );
};

describe("MemoHeader navigation", () => {
  beforeEach(() => {
    state.creator = undefined;
  });

  it.each([false, true])("uses a keyboard-operable timestamp and preserves origin when showCreator=%s", (showCreator) => {
    if (showCreator) {
      state.creator = { username: "alice", displayName: "Alice", avatarUrl: "" };
    }

    render(
      <MemoryRouter initialEntries={["/explore?filter=tagSearch%3Awork"]}>
        <MemoHeader showCreator={showCreator} />
        <LocationProbe />
      </MemoryRouter>,
    );

    const timestamp = screen.getByRole("button", { name: "time" });
    timestamp.focus();
    expect(timestamp).toHaveFocus();

    fireEvent.click(timestamp);
    expect(screen.getByTestId("location")).toHaveTextContent(
      '/memos/123|{"from":"/explore?filter=tagSearch%3Awork","fromScope":"preserve"}',
    );
  });

  it.each([false, true])("keeps the Space pill beside the timestamp when showCreator=%s", (showCreator) => {
    if (showCreator) {
      state.creator = { username: "alice", displayName: "Alice", avatarUrl: "" };
    }

    render(
      <MemoryRouter>
        <MemoHeader showCreator={showCreator} showSpace />
      </MemoryRouter>,
    );

    const timestamp = screen.getByRole("button", { name: "time" });
    const space = screen.getByTestId("memo-space");
    const metadata = space.closest('[data-slot="memo-header-meta"]');

    expect(metadata).toContainElement(timestamp);
    expect(space.closest("a, button")).toBeNull();
  });

  it("truncates linked reminder titles to one line instead of expanding the header", () => {
    state.currentUser = { name: "users/demo" };
    const longTitle = "整理本周的阅读摘录并同步到个人知识库的第二部分";
    render(
      <MemoryRouter>
        <MemoHeader
          linkedReminders={[
            create(ReminderSchema, { name: "users/demo/reminders/one", title: longTitle }),
            create(ReminderSchema, { name: "users/demo/reminders/two", title: "Second reminder" }),
          ]}
        />
      </MemoryRouter>,
    );

    const chip = screen.getByRole("button", { name: longTitle });
    expect(chip).toHaveClass("max-w-40", "min-w-0", "shrink", "sm:max-w-56");
    expect(within(chip).getByText(longTitle)).toHaveClass("truncate");
    expect(chip).toHaveAttribute("title", longTitle);
  });

  it("shows at most two linked reminders and summarizes the rest", () => {
    state.currentUser = { name: "users/demo" };
    render(
      <MemoryRouter>
        <MemoHeader
          linkedReminders={["First", "Second", "Third", "Fourth"].map((title, index) =>
            create(ReminderSchema, { name: `users/demo/reminders/${index}`, title }),
          )}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "First" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Second" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Third" })).not.toBeInTheDocument();
    expect(screen.getByTitle("Third Fourth")).toHaveTextContent("+2");
  });
});
