import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FinanceSettings from "@/components/Settings/FinanceSettings";
import { State } from "@/types/proto/api/v1/common_pb";
import { FinanceWalletSchema } from "@/types/proto/api/v1/finance_service_pb";

const mutations = vi.hoisted(() => ({ deleteWallet: vi.fn(), updateWallet: vi.fn() }));

vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/test" }) }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));
vi.mock("@/hooks/useFinanceQueries", () => ({
  useFinanceWallets: () => ({
    data: [
      create(FinanceWalletSchema, { name: "users/test/wallets/active", displayName: "Current wallet", state: State.NORMAL }),
      create(FinanceWalletSchema, { name: "users/test/wallets/disabled", displayName: "Disabled wallet", state: State.ARCHIVED }),
      create(FinanceWalletSchema, {
        name: "users/test/wallets/deleted",
        displayName: "Deleted wallet",
        state: State.ARCHIVED,
        deleteTime: timestampFromDate(new Date()),
      }),
    ],
  }),
  useFinanceCategories: () => ({ data: [] }),
  useCreateFinanceWallet: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateFinanceWallet: () => ({ mutateAsync: mutations.updateWallet }),
  useDeleteFinanceWallet: () => ({ mutateAsync: mutations.deleteWallet }),
  useCreateFinanceCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateFinanceCategory: () => ({ mutateAsync: vi.fn() }),
  useAdjustFinanceWalletBalance: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe("wallet lifecycle", () => {
  it("offers deletion only for a disabled wallet and keeps deleted wallets out of management", async () => {
    mutations.deleteWallet.mockResolvedValue(undefined);
    render(<FinanceSettings />);
    expect(screen.queryByText("Deleted wallet")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "finance.wallet.disable" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "finance.wallet.restore" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "common.delete" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("finance.wallet.delete-description")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "common.delete" }));
    await waitFor(() => expect(mutations.deleteWallet).toHaveBeenCalledWith("users/test/wallets/disabled"));
  });
});
