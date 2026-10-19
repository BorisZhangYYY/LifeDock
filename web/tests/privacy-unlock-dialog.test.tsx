import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PrivacyUnlockDialog from "@/components/PrivacyUnlockDialog";

const { verifyPassword, toastError } = vi.hoisted(() => ({ verifyPassword: vi.fn(), toastError: vi.fn() }));

vi.mock("@/connect", () => ({ authServiceClient: { verifyPassword } }));
vi.mock("react-hot-toast", () => ({ default: { error: toastError } }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

describe("PrivacyUnlockDialog", () => {
  beforeEach(() => {
    verifyPassword.mockReset();
    toastError.mockReset();
  });

  it("verifies the current password before revealing content", async () => {
    verifyPassword.mockResolvedValue({});
    const onOpenChange = vi.fn();
    const onUnlocked = vi.fn();
    render(<PrivacyUnlockDialog open onOpenChange={onOpenChange} onUnlocked={onUnlocked} />);

    const password = screen.getByLabelText("common.password");
    fireEvent.change(password, { target: { value: "account password" } });
    fireEvent.click(screen.getByRole("button", { name: "setting.personal-features.unlock" }));

    await waitFor(() => expect(verifyPassword).toHaveBeenCalledWith({ password: "account password" }));
    expect(onUnlocked).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the content locked after an incorrect password", async () => {
    verifyPassword.mockRejectedValue(new Error("incorrect password"));
    const onUnlocked = vi.fn();
    render(<PrivacyUnlockDialog open onOpenChange={vi.fn()} onUnlocked={onUnlocked} />);

    fireEvent.change(screen.getByLabelText("common.password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "setting.personal-features.unlock" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("setting.personal-features.incorrect-password", { id: "privacy-unlock-error" }),
    );
    expect(screen.queryByText("setting.personal-features.incorrect-password")).not.toBeInTheDocument();
    expect(onUnlocked).not.toHaveBeenCalled();
    expect(screen.getByLabelText("common.password")).toHaveValue("");
  });

  it.each(["cancel", "unmount"])("does not unlock when verification finishes after %s", async (action) => {
    let finish!: () => void;
    verifyPassword.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const onUnlocked = vi.fn();
    const view = render(<PrivacyUnlockDialog open onOpenChange={vi.fn()} onUnlocked={onUnlocked} />);
    fireEvent.change(screen.getByLabelText("common.password"), { target: { value: "account password" } });
    fireEvent.click(screen.getByRole("button", { name: "setting.personal-features.unlock" }));
    if (action === "cancel") fireEvent.click(screen.getByRole("button", { name: "Close" }));
    else view.unmount();
    await act(async () => finish());
    expect(onUnlocked).not.toHaveBeenCalled();
  });
});
