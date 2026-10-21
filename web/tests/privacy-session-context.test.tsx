import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PrivacySessionProvider, usePrivacySession } from "@/contexts/PrivacySessionContext";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ currentUser: { name: "users/test" } }) }));
vi.mock("@/hooks/usePersonalFeatures", () => ({
  default: () => ({ remindersEnabled: true, privacyMode: 1, requirePasswordForPrivateContent: true }),
}));
const Consumer = () => {
  const privacy = usePrivacySession();
  return (
    <div>
      <span data-testid="personal-unlocked">{String(privacy.unlocked)}</span>
      <span data-testid="linked-unlocked">{String(privacy.isMemoUnlocked("memos/linked"))}</span>
      <span data-testid="other-unlocked">{String(privacy.isMemoUnlocked("memos/other"))}</span>
      <button type="button" onClick={privacy.unlockAll}>
        unlock all
      </button>
      <button type="button" onClick={() => privacy.unlockMemo("memos/linked")}>
        unlock memo
      </button>
      <button type="button" onClick={() => privacy.lockMemo("memos/linked")}>
        lock linked memo
      </button>
      <button type="button" onClick={privacy.lockAll}>
        lock all
      </button>
    </div>
  );
};

describe("PrivacySessionProvider", () => {
  it("keeps dashboard and individual memo unlocks independent", () => {
    render(
      <PrivacySessionProvider>
        <Consumer />
      </PrivacySessionProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "unlock memo" }));
    expect(screen.getByTestId("personal-unlocked")).toHaveTextContent("false");
    expect(screen.getByTestId("linked-unlocked")).toHaveTextContent("true");
    expect(screen.getByTestId("other-unlocked")).toHaveTextContent("false");
    fireEvent.click(screen.getByRole("button", { name: "lock linked memo" }));
    fireEvent.click(screen.getByRole("button", { name: "unlock all" }));
    expect(screen.getByTestId("personal-unlocked")).toHaveTextContent("true");
    expect(screen.getByTestId("linked-unlocked")).toHaveTextContent("false");
    fireEvent.click(screen.getByRole("button", { name: "unlock memo" }));
    fireEvent.click(screen.getByRole("button", { name: "lock all" }));
    expect(screen.getByTestId("personal-unlocked")).toHaveTextContent("false");
    expect(screen.getByTestId("linked-unlocked")).toHaveTextContent("true");
  });
});
