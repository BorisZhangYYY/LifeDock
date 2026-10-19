import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, Link, Navigate, Outlet, RouterProvider, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PersonalContent from "@/components/PersonalContent";
import PersonalNavigationGuard from "@/components/PersonalNavigationGuard";
import { PrivacySessionProvider } from "@/contexts/PrivacySessionContext";

const mocks = vi.hoisted(() => ({ privacy: 1, verify: vi.fn(), toastError: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: { name: "users/test" },
    isUserSettingsInitialized: true,
    userGeneralSetting: { personalFeaturePrivacy: mocks.privacy, requirePasswordForPrivateContent: false },
  }),
}));
vi.mock("@/hooks/useReminderQueries", () => ({ useReminders: () => ({ data: [] }) }));
vi.mock("@/connect", () => ({ authServiceClient: { verifyPassword: mocks.verify } }));
vi.mock("react-hot-toast", () => ({ default: { error: mocks.toastError } }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

const Layout = () => {
  const location = useLocation();
  return (
    <>
      <Link to="/personal">Personal entry</Link>
      <Link to="/finance#statistics">Finance entry</Link>
      <Link to="/map">Map entry</Link>
      <output data-testid="location">
        {location.pathname}
        {location.hash}
      </output>
      <PersonalNavigationGuard>
        <Outlet />
      </PersonalNavigationGuard>
    </>
  );
};
const setup = (path = "/map") => {
  const router = createMemoryRouter(
    [
      {
        element: <Layout />,
        children: [
          { path: "personal", element: <Navigate to="/reminders" replace /> },
          {
            path: "reminders",
            element: (
              <PersonalContent>
                <div>Reminder content</div>
              </PersonalContent>
            ),
          },
          {
            path: "finance",
            element: (
              <PersonalContent>
                <div>Finance content</div>
              </PersonalContent>
            ),
          },
          { path: "*", element: <div>Original page</div> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <PrivacySessionProvider>
      <RouterProvider router={router} />
    </PrivacySessionProvider>,
  );
  return router;
};
const submit = (password = "correct password") => {
  fireEvent.change(screen.getByLabelText("common.password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "setting.personal-features.unlock" }));
};

beforeEach(() => {
  mocks.privacy = 1;
  mocks.verify.mockReset();
  mocks.verify.mockResolvedValue({});
  mocks.toastError.mockReset();
});

describe("personal navigation password boundary", () => {
  it.each([
    "/",
    "/map",
    "/calendar/2026/10",
    "/memos/test",
    "/setting",
  ])("keeps %s mounted until the entry password is correct", async (path) => {
    const router = setup(path);
    fireEvent.click(screen.getByRole("link", { name: "Personal entry" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(path);
    expect(screen.getByText("Original page")).toBeInTheDocument();
    expect(screen.queryByText("Reminder content")).not.toBeInTheDocument();
    submit();
    expect(await screen.findByText("Reminder content")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/reminders");
    expect(screen.queryByRole("button", { name: "setting.personal-features.reveal-personal-panels" })).not.toBeInTheDocument();
  });

  it("reports errors through toast and never navigates on an incorrect password or close", async () => {
    const router = setup();
    mocks.verify.mockRejectedValueOnce(new Error("incorrect password"));
    fireEvent.click(screen.getByRole("link", { name: "Personal entry" }));
    await screen.findByRole("dialog");
    submit("wrong password");
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(router.state.location.pathname).toBe("/map");
    expect(screen.queryByText("Reminder content")).not.toBeInTheDocument();
    expect(screen.queryByText("setting.personal-features.incorrect-password")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/map");
  });

  it("verifies again after leaving and re-entering the personal area", async () => {
    const router = setup();
    fireEvent.click(screen.getByRole("link", { name: "Personal entry" }));
    await screen.findByRole("dialog");
    submit();
    await screen.findByText("Reminder content");
    fireEvent.click(screen.getByRole("link", { name: "Map entry" }));
    await screen.findByText("Original page");
    fireEvent.click(screen.getByRole("link", { name: "Finance entry" }));
    await screen.findByRole("dialog");
    expect(router.state.location.pathname).toBe("/map");
    submit();
    await screen.findByText("Finance content");
    expect(router.state.location.hash).toBe("#statistics");
  });

  it("keeps direct private links unmounted and returns home before verification", async () => {
    const router = setup("/finance#statistics");
    await screen.findByRole("dialog");
    expect(router.state.location.pathname).toBe("/");
    expect(screen.queryByText("Finance content")).not.toBeInTheDocument();
    submit();
    await screen.findByText("Finance content");
    expect(router.state.location.pathname).toBe("/finance");
    expect(router.state.location.hash).toBe("#statistics");
  });

  it("opens personal pages directly when hiding is disabled", async () => {
    mocks.privacy = 0;
    setup();
    fireEvent.click(screen.getByRole("link", { name: "Personal entry" }));
    await screen.findByText("Reminder content");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.verify).not.toHaveBeenCalled();
  });
});
