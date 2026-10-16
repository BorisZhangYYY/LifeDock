import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Reminders from "@/pages/Reminders";
import { ListRemindersRequest_View } from "@/types/proto/api/v1/reminder_service_pb";
import { rememberReminderList } from "@/utils/reminder-list-selection";

const state = vi.hoisted(() => ({
  requests: [] as Array<Record<string, unknown>>,
  empty: false,
  memo: "",
  create: vi.fn(),
  createList: vi.fn(),
  clear: vi.fn(),
}));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/test" }) }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));
vi.mock("@/hooks/useReminderQueries", () => {
  const lists = [
    { name: "users/test/reminderLists/default", displayName: "Default" },
    { name: "users/test/reminderLists/work", displayName: "Work" },
  ];
  const reminders = [
    { name: "users/test/reminders/one", title: "Review notes", reminderList: lists[1].name, priority: 0, flagged: false, status: 1 },
  ];
  const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return {
    useReminderLists: () => ({ data: lists }),
    useReminders: (_parent: string, request: Record<string, unknown>) => {
      state.requests.push(request);
      return { data: state.empty ? [] : reminders.map((reminder) => ({ ...reminder, memo: state.memo })), isLoading: false };
    },
    useCreateReminder: () => ({ mutateAsync: state.create, isPending: false }),
    useCompleteReminder: mutation,
    useClearCompletedReminders: () => ({ mutateAsync: state.clear, isPending: false }),
    useDeleteReminder: mutation,
    useDeleteReminderList: mutation,
    useUpdateReminder: mutation,
    useCreateReminderList: () => ({ mutateAsync: state.createList, isPending: false }),
    useUpdateReminderList: mutation,
  };
});
vi.mock("@/components/Reminder/ReminderCompletionDialog", () => ({ default: () => null }));
vi.mock("@/components/Reminder/ReminderDetailDialog", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div>Reminder details</div> : null),
}));
vi.mock("@/components/Reminder/ReminderListDialog", () => ({
  default: ({
    open,
    list,
    onSave,
  }: {
    open: boolean;
    list?: { displayName: string };
    onSave: (value: { displayName: string; color: string; icon: string }) => Promise<void>;
  }) =>
    open ? (
      <div data-testid="list-dialog">
        {list?.displayName ?? "New list"}
        <button type="button" onClick={() => void onSave({ displayName: "New list", color: "#0A84FF", icon: "work" })}>
          Save list
        </button>
      </div>
    ) : null,
}));
vi.mock("@/components/Reminder/ReminderStatistics", () => ({ default: () => <div>Reminder statistics</div> }));

const LocationState = () => {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search} ${JSON.stringify(location.state)}`}</output>;
};

describe("reminder page navigation", () => {
  beforeEach(() => {
    state.requests = [];
    state.empty = false;
    state.memo = "";
    state.create.mockReset();
    state.create.mockResolvedValue(undefined);
    state.clear.mockReset();
    state.clear.mockResolvedValue({ clearedCount: 1 });
    state.createList.mockReset();
    state.createList.mockResolvedValue({ name: "users/test/reminderLists/new" });
    localStorage.clear();
  });

  const mount = (url = "/reminders") =>
    render(
      <MemoryRouter initialEntries={[url]}>
        <Reminders />
        <LocationState />
      </MemoryRouter>,
    );

  it("clears completed reminders explicitly without offering a new archive action", async () => {
    mount("/reminders?view=completed");
    expect(screen.queryByRole("button", { name: "common.archive" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "reminder.clear-completed" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("reminder.clear-completed-description")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "common.clear" }));
    await waitFor(() => expect(state.clear).toHaveBeenCalledWith("users/test"));
  });

  it("shows a single list with top filters and switches to statistics", () => {
    const { container } = mount();
    expect(container.querySelector("aside")).toBeNull();
    expect(screen.getByRole("button", { name: "Review notes" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "reminder.view-all" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "common.statistics" }));
    expect(screen.getByText("Reminder statistics")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review notes" })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("reminder.search")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "personal.records" }));
    expect(screen.getByRole("button", { name: "Review notes" })).toBeInTheDocument();
  });

  it.each(["all", "completed"])("opens a linked Memo from its metadata in the %s view and keeps the return location", (view) => {
    state.memo = "memos/linked";
    const origin = `/reminders?view=${view}&list=users/test/reminderLists/work`;
    mount(origin);
    const link = screen.getByRole("link", { name: "reminder.open-linked-memo" });
    expect(link).toHaveAttribute("href", "/memos/linked");
    expect(screen.getByRole("button", { name: "Review notes" })).toBeInTheDocument();
    expect(screen.queryByText("Reminder details")).not.toBeInTheDocument();
    fireEvent.click(link);
    expect(screen.getByTestId("location")).toHaveTextContent(`/memos/linked ${JSON.stringify({ from: origin })}`);
    expect(screen.queryByText("Reminder details")).not.toBeInTheDocument();
  });

  it("opens details from a linked reminder title without navigating to its Memo", () => {
    state.memo = "memos/linked";
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Review notes" }));
    expect(screen.getByText("Reminder details")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/reminders null");
  });

  it("keeps editing available for linked reminders", () => {
    state.memo = "memos/linked";
    mount();
    fireEvent.click(screen.getByRole("button", { name: "reminder.details" }));
    expect(screen.getByText("Reminder details")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/reminders null");
  });

  it("opens details when a reminder has no linked Memo", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Review notes" }));
    expect(screen.getByText("Reminder details")).toBeInTheDocument();
  });

  it("combines a selected list with a top filter and preserves both in the URL", () => {
    mount("/reminders?view=all&list=users/test/reminderLists/work");
    fireEvent.click(screen.getByRole("button", { name: /reminder.scheduled/ }));
    expect(state.requests).toContainEqual(
      expect.objectContaining({ view: ListRemindersRequest_View.SCHEDULED, reminderList: "users/test/reminderLists/work", enabled: true }),
    );
    expect(screen.getByTestId("location")).toHaveTextContent("view=scheduled");
    expect(screen.getByTestId("location")).toHaveTextContent("list=users%2Ftest%2FreminderLists%2Fwork");
  });

  it("shows the add prompt when the selected list is empty", () => {
    state.empty = true;
    mount("/reminders?view=all&list=users/test/reminderLists/work");
    expect(screen.getByText("reminder.click-empty-to-create")).toBeInTheDocument();
  });

  it("opens All despite a remembered list and keeps empty list add targets visible", () => {
    rememberReminderList("users/test", "users/test/reminderLists/work");
    mount();
    expect(screen.getByRole("button", { name: "common.reminders 0" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Work 1" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /reminder.click-empty-to-create:/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /reminder.scheduled/ }));
    expect(state.requests).toContainEqual(
      expect.objectContaining({ view: ListRemindersRequest_View.SCHEDULED, reminderList: "", enabled: true }),
    );
    expect(screen.getByTestId("location")).not.toHaveTextContent("list=");
  });

  it.each([
    ["common.reminders", "users/test/reminderLists/default"],
    ["Work", "users/test/reminderLists/work"],
  ])("creates a reminder in the list whose add row was clicked: %s", async (label, listName) => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "reminder.click-empty-to-create: " + label }));
    const input = screen.getByPlaceholderText("reminder.new-reminder");
    fireEvent.change(input, { target: { value: "New reminder" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(state.create).toHaveBeenCalledWith(
        expect.objectContaining({
          parent: "users/test",
          reminder: expect.objectContaining({ title: "New reminder", reminderList: listName }),
        }),
      ),
    );
  });

  it("returns from a selected list to all list groups", () => {
    mount("/reminders?view=all&list=users/test/reminderLists/work");
    fireEvent.click(screen.getByRole("button", { name: /common.all/ }));
    expect(screen.getByRole("button", { name: "common.reminders 0" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Work 1" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).not.toHaveTextContent("list=");
  });

  it("stays in Settings after creating a list", async () => {
    mount();
    fireEvent.click(screen.getByRole("tab", { name: "common.settings" }));
    fireEvent.click(screen.getByRole("button", { name: "reminder.new-list" }));
    fireEvent.click(screen.getByRole("button", { name: "Save list" }));
    await waitFor(() => expect(state.createList).toHaveBeenCalledOnce());
    expect(screen.getByRole("tab", { name: "common.settings" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("location")).toHaveTextContent("view=settings");
    expect(screen.getByTestId("location")).not.toHaveTextContent("list=");
  });

  it("manages every list from Settings and protects the default list from deletion", () => {
    mount();
    expect(screen.queryByRole("button", { name: "reminder.manage-list" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "common.settings" }));
    expect(screen.getByRole("button", { name: "common.edit common.reminders" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.edit Work" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "common.delete common.reminders" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.delete Work" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("reminder.search")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "common.edit Work" }));
    expect(screen.getByTestId("list-dialog")).toHaveTextContent("Work");
  });
});
