import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, type RouteObject, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { routeConfig } from "@/router";

const features = vi.hoisted(() => ({ remindersEnabled: true, financeEnabled: true, moodEnabled: true }));
vi.mock("@/hooks/usePersonalFeatures", () => ({ default: () => features }));

const findPersonalEntry = (routes: RouteObject[]): RouteObject | undefined => {
  for (const route of routes) {
    if (route.path === "/personal") return route;
    const child = route.children && findPersonalEntry(route.children);
    if (child) return child;
  }
};

const Destination = () => <output data-testid="destination">{useLocation().pathname}</output>;

describe("personal management entry", () => {
  beforeEach(() => {
    features.remindersEnabled = true;
    features.financeEnabled = true;
    features.moodEnabled = true;
  });

  it.each([
    [true, true, true, "/reminders"],
    [false, true, true, "/finance"],
    [false, false, true, "/mood"],
    [false, false, false, "/"],
  ])("opens an enabled module (%s, %s, %s)", (remindersEnabled, financeEnabled, moodEnabled, destination) => {
    Object.assign(features, { remindersEnabled, financeEnabled, moodEnabled });
    render(
      <MemoryRouter initialEntries={["/personal"]}>
        <Routes>
          <Route path="/personal" element={findPersonalEntry(routeConfig)?.element} />
          <Route path="*" element={<Destination />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("destination")).toHaveTextContent(destination);
  });
});
