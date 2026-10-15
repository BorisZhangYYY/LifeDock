import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MoodDashboard from "@/components/MoodDashboard";

vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => ({ memoRelatedSetting: {} }),
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

describe("<MoodDashboard>", () => {
  it("opens the exact memo associated with a mood record", () => {
    const onMemoSelect = vi.fn();
    const createTime = new Date();
    createTime.setHours(10, 30, 15, 0);

    render(<MoodDashboard points={[{ createTime, moodLevel: 6, memoName: "memos/mood-123" }]} onMemoSelect={onMemoSelect} />);

    fireEvent.click(screen.getByTitle("mood.dashboard.open-memo"));
    expect(onMemoSelect).toHaveBeenCalledOnce();
    expect(onMemoSelect).toHaveBeenCalledWith("memos/mood-123");
  });

  it("shows records and statistics separately without a statistics dialog button", () => {
    const { rerender } = render(<MoodDashboard points={[]} view="records" />);
    expect(screen.getByText("mood.dashboard.empty-today")).toBeInTheDocument();
    expect(screen.queryByText("mood.insights.title")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "mood.dashboard.view-details" })).not.toBeInTheDocument();

    rerender(<MoodDashboard points={[]} view="statistics" />);
    expect(screen.getByText("mood.insights.title")).toBeInTheDocument();
    expect(screen.queryByText("mood.dashboard.empty-today")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
