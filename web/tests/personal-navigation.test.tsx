import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PersonalNavigation from "@/components/AppSidebar/PersonalNavigation";
import { AppSidebarProvider, useAppSidebar } from "@/contexts/AppSidebarContext";

const features = vi.hoisted(() => ({ remindersEnabled: true, financeEnabled: true, moodEnabled: true }));
vi.mock("@/hooks/usePersonalFeatures", () => ({ default: () => features }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/test" }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isUserSettingsInitialized: true }) }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

const Harness = () => {
  const location = useLocation();
  const { mobileOpen, setMobileOpen } = useAppSidebar();
  return (
    <>
      <button type="button" onClick={() => setMobileOpen(true)}>
        Open mobile navigation
      </button>
      {mobileOpen && <PersonalNavigation />}
      <output data-testid="path">{location.pathname}</output>
    </>
  );
};

describe("personal sidebar navigation", () => {
  beforeEach(() => {
    features.remindersEnabled = true;
    features.financeEnabled = true;
    features.moodEnabled = true;
  });

  const mount = () =>
    render(
      <MemoryRouter>
        <AppSidebarProvider>
          <Harness />
        </AppSidebarProvider>
      </MemoryRouter>,
    );

  it("opens the mood page and closes mobile navigation", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Open mobile navigation" }));
    fireEvent.click(screen.getByRole("link", { name: "personal.mood" }));
    expect(screen.queryByRole("link", { name: "personal.mood" })).not.toBeInTheDocument();
    expect(screen.getByTestId("path")).toHaveTextContent("/mood");
  });

  it.each([
    ["personal.finance", "/finance"],
    ["common.reminders", "/reminders"],
    ["personal.mood", "/mood"],
  ])("opens %s as a standalone page", (label, path) => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Open mobile navigation" }));
    fireEvent.click(screen.getByRole("link", { name: label }));
    expect(screen.getByTestId("path")).toHaveTextContent(path);
  });

  it("hides disabled modules while keeping the enabled mood page", () => {
    features.financeEnabled = false;
    features.remindersEnabled = false;
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Open mobile navigation" }));
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "personal.mood" })).toBeInTheDocument();
  });
});
