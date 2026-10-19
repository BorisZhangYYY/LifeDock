import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Calendar from "@/pages/Calendar";

vi.mock("@/components/CalendarView", async () => ({
  ...(await vi.importActual<typeof import("@/components/CalendarView/paths")>("@/components/CalendarView/paths")),
  CalendarView: () => <div>Calendar ready</div>,
}));

const LocationProbe = () => {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
};

describe("calendar entry redirects", () => {
  it.each(["/calendar", "/calendar/2026/99/42"])("keeps creator and filters when normalizing %s to a real month", async (entry) => {
    render(
      <MemoryRouter initialEntries={[`${entry}?creator=TestUser&filter=tagSearch%3A旅行`]}>
        <LocationProbe />
        <Routes>
          <Route path="/calendar/:year?/:month?/:day?" element={<Calendar />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("Calendar ready")).toBeInTheDocument());
    const url = new URL(screen.getByTestId("location").textContent ?? "", "http://localhost");
    expect(url.pathname).toMatch(/^\/calendar\/\d{4}\/\d{2}$/);
    expect(url.searchParams.get("creator")).toBe("TestUser");
    expect(url.searchParams.get("filter")).toBe("tagSearch:旅行");
  });
});
