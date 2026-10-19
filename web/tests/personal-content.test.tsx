import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PersonalContent from "@/components/PersonalContent";

const state = vi.hoisted(() => ({ privacyMode: 0, unlocked: false }));
vi.mock("@/hooks/usePersonalFeatures", () => ({ default: () => state }));
vi.mock("@/contexts/PrivacySessionContext", () => ({ usePrivacySession: () => state }));

beforeEach(() => {
  state.privacyMode = 0;
  state.unlocked = false;
});

describe("personal page content", () => {
  it("shows ordinary content without a reveal control", () => {
    render(
      <PersonalContent>
        <div>Private history</div>
      </PersonalContent>,
    );
    expect(screen.getByText("Private history")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps personal content unmounted until navigation verification succeeds", () => {
    state.privacyMode = 1;
    const view = render(
      <PersonalContent>
        <div>Private history</div>
      </PersonalContent>,
    );
    expect(screen.queryByText("Private history")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    state.unlocked = true;
    view.rerender(
      <PersonalContent>
        <div>Private history</div>
      </PersonalContent>,
    );
    expect(screen.getByText("Private history")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
