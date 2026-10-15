import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PersonalContent from "@/components/PersonalContent";

const state = vi.hoisted(() => ({ privacyMode: 0, requirePasswordForPrivateContent: false, unlocked: false }));
vi.mock("@/hooks/usePersonalFeatures", () => ({ default: () => state }));
vi.mock("@/contexts/PrivacySessionContext", () => ({ usePrivacySession: () => ({ unlocked: state.unlocked, lockAll: vi.fn() }) }));
vi.mock("@/components/PrivacyUnlockDialog", () => ({ default: () => <div role="dialog">Unlock</div> }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

describe("personal page privacy", () => {
  beforeEach(() => {
    state.privacyMode = 0;
    state.requirePasswordForPrivateContent = false;
    state.unlocked = false;
  });

  it("reveals and hides personal page content on demand", () => {
    state.privacyMode = 1;
    render(
      <PersonalContent>
        <div>Private history</div>
      </PersonalContent>,
    );
    expect(screen.queryByText("Private history")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "setting.personal-features.reveal-personal-panels" }));
    expect(screen.getByText("Private history")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "setting.personal-features.hide-again" }));
    expect(screen.queryByText("Private history")).not.toBeInTheDocument();
  });

  it("requires the existing unlock flow before mounting password-protected content", () => {
    state.privacyMode = 1;
    state.requirePasswordForPrivateContent = true;
    render(
      <PersonalContent>
        <div>Private history</div>
      </PersonalContent>,
    );
    fireEvent.click(screen.getByRole("button", { name: "setting.personal-features.reveal-personal-panels" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Unlock");
    expect(screen.queryByText("Private history")).not.toBeInTheDocument();
  });
});
