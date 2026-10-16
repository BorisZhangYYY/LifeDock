import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReminderDashboard from "@/components/Reminder/ReminderDashboard";

const reminderState = vi.hoisted(() => ({ complete: vi.fn(), reminders: [] as Array<Record<string, unknown>> }));

vi.mock("@/hooks/useReminderQueries", () => ({
  useCompleteReminder: () => ({ mutate: reminderState.complete }),
  useReminderLists: () => ({ data: [] }),
  useReminders: () => ({ data: reminderState.reminders }),
}));

vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

const LocationState = () => {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname} ${JSON.stringify(location.state)}`}</output>;
};

describe("<ReminderDashboard>", () => {
  const mount = (onOpenReminder = vi.fn()) =>
    render(
      <MemoryRouter initialEntries={["/personal?tab=reminders"]}>
        <ReminderDashboard parent="users/demo" onOpenCenter={vi.fn()} onOpenReminder={onOpenReminder} />
        <LocationState />
      </MemoryRouter>,
    );

  beforeEach(() => {
    reminderState.complete.mockReset();
    reminderState.reminders = [];
  });

  it("keeps the empty dashboard completion-only", () => {
    mount();

    expect(screen.getByText("reminder.dashboard-empty")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "reminder.click-empty-to-create" })).not.toBeInTheDocument();
  });

  it("lets the dashboard complete existing reminders without exposing a create action", () => {
    reminderState.reminders = [
      {
        name: "users/demo/reminders/one",
        title: "Buy milk",
        reminderList: "users/demo/reminderLists/default",
        priority: 0,
        flagged: false,
      },
    ];
    mount();

    fireEvent.click(screen.getByRole("button", { name: "reminder.complete" }));
    expect(reminderState.complete).toHaveBeenCalledWith({ name: "users/demo/reminders/one" });
    expect(screen.queryByRole("button", { name: "reminder.click-empty-to-create" })).not.toBeInTheDocument();
  });

  it("opens a linked Memo from metadata while the title and edit action open the reminder", () => {
    reminderState.reminders = [{ name: "users/demo/reminders/one", title: "Buy milk", priority: 0, memo: "memos/shopping" }];
    const openReminder = vi.fn();
    mount(openReminder);
    fireEvent.click(screen.getByRole("button", { name: "Buy milk" }));
    expect(openReminder).toHaveBeenCalledWith("users/demo/reminders/one");
    openReminder.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "common.edit: Buy milk" }));
    expect(openReminder).toHaveBeenCalledWith("users/demo/reminders/one");
    openReminder.mockClear();
    fireEvent.click(screen.getByRole("link", { name: "reminder.open-linked-memo" }));
    expect(openReminder).not.toHaveBeenCalled();
    expect(screen.getByTestId("location")).toHaveTextContent('/memos/shopping {"from":"/personal?tab=reminders"}');
  });
});
