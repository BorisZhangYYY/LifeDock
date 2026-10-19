import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PersonalDashboardWidget from "@/components/PersonalDashboardWidget";

vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));
const { privacyState } = vi.hoisted(() => ({
  privacyState: { privacyMode: 0, requirePasswordForPrivateContent: false },
}));
vi.mock("@/hooks/usePersonalFeatures", () => ({
  default: () => privacyState,
}));
vi.mock("@/contexts/PrivacySessionContext", () => ({
  usePrivacySession: () => {
    const [unlocked, setUnlocked] = useState(false);
    return { unlocked, unlockAll: () => setUnlocked(true), lockAll: () => setUnlocked(false) };
  },
}));
vi.mock("@/components/PrivacyUnlockDialog", () => ({
  default: ({ onUnlocked, onOpenChange }: { onUnlocked: () => void; onOpenChange: (open: boolean) => void }) => (
    <div role="dialog">
      <button
        type="button"
        onClick={() => {
          onUnlocked();
          onOpenChange(false);
        }}
      >
        Verify password
      </button>
    </div>
  ),
}));

const renderWidget = () =>
  render(
    <PersonalDashboardWidget labels={["Mood", "Finance", "Reminders"]}>
      <div>Mood panel</div>
      <div>Finance panel</div>
      <div>Reminder panel</div>
    </PersonalDashboardWidget>,
  );

describe("PersonalDashboardWidget", () => {
  beforeEach(() => {
    localStorage.clear();
    privacyState.privacyMode = 0;
    privacyState.requirePasswordForPrivateContent = false;
  });

  it("expands the active dashboard and remembers the preference", () => {
    const firstRender = renderWidget();
    const expandButton = screen.getByRole("button", { expanded: false });

    expect(screen.getByRole("tabpanel")).toHaveClass("h-64");

    fireEvent.click(expandButton);

    expect(screen.getByRole("tabpanel")).toHaveClass("h-[min(36rem,70dvh)]");
    expect(expandButton).toHaveAttribute("aria-expanded", "true");

    firstRender.unmount();
    renderWidget();

    expect(screen.getByRole("tabpanel")).toHaveClass("h-[min(36rem,70dvh)]");
    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument();
  });

  it("keeps dashboard content unmounted until password verification", () => {
    privacyState.privacyMode = 1;
    renderWidget();

    expect(screen.getByRole("tabpanel")).toHaveClass("blur-lg");
    expect(screen.queryByText("Mood panel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "setting.personal-features.reveal-personal-panels" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText("Mood panel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Verify password" }));
    expect(screen.getByRole("tabpanel")).not.toHaveClass("blur-lg");
    expect(screen.getByText("Mood panel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "setting.personal-features.hide-again" })).toBeInTheDocument();
  });

  it("requests verification when selecting a hidden personal tab", () => {
    privacyState.privacyMode = 1;
    renderWidget();
    fireEvent.click(screen.getByRole("tab", { name: "Finance" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText("Finance panel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Verify password" }));
    expect(screen.getByText("Finance panel")).toBeInTheDocument();
  });
});
