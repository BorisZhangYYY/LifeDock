import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FinanceDashboard from "@/components/Finance/FinanceDashboard";
import { type FinanceTransaction, FinanceTransaction_Type, FinanceTransactionSchema } from "@/types/proto/api/v1/finance_service_pb";

const state = vi.hoisted(() => ({ historyEnabled: false, transactions: [] as FinanceTransaction[], deleteTransaction: vi.fn() }));
vi.mock("@/hooks/useFinanceQueries", () => ({
  useFinanceWallets: () => ({
    data: [
      { name: "users/test/wallets/one", displayName: "Wallet", balanceMinor: 100n },
      { name: "users/test/wallets/deleted", displayName: "Old wallet", balanceMinor: 50n, deleteTime: { seconds: 1n } },
    ],
  }),
  useFinanceCategories: () => ({ data: [] }),
  useFinanceSummary: () => ({ data: undefined }),
  useFinanceTransactions: () => ({ data: state.transactions }),
  useFinanceTransactionHistory: (_parent: string, enabled: boolean) => {
    state.historyEnabled = enabled;
    return { data: [], isLoading: false };
  },
  useDeleteFinanceTransaction: () => ({ mutateAsync: state.deleteTransaction, isPending: false }),
}));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

describe("finance page sections", () => {
  beforeEach(() => {
    state.historyEnabled = false;
    state.transactions = [];
    state.deleteTransaction.mockReset();
    state.deleteTransaction.mockResolvedValue(undefined);
  });

  it("strikes through deleted wallet names and deletes an erroneous transaction", async () => {
    state.transactions = [
      create(FinanceTransactionSchema, {
        name: "users/test/financeTransactions/error",
        wallet: "users/test/wallets/deleted",
        type: FinanceTransaction_Type.EXPENSE,
        amountMinor: 100n,
        occurTime: timestampFromDate(new Date()),
      }),
    ];
    render(<FinanceDashboard parent="users/test" view="records" />);
    expect(screen.getByText("Old wallet")).toHaveClass("line-through");
    expect(screen.getByText("Old wallet")).toHaveAttribute("title", "finance.wallet.deleted");
    fireEvent.click(screen.getByRole("button", { name: "finance.transaction.delete" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("finance.transaction.delete-description")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "finance.transaction.delete" }));
    await waitFor(() => expect(state.deleteTransaction).toHaveBeenCalledWith("users/test/financeTransactions/error"));
  });

  it("switches the displayed section and loads complete history only when selected", () => {
    const { rerender } = render(<FinanceDashboard parent="users/test" view="records" />);
    expect(screen.getByText("finance.dashboard.empty-today")).toBeInTheDocument();
    expect(screen.queryByText("finance.insights.title")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "finance.dashboard.view-details" })).not.toBeInTheDocument();
    expect(state.historyEnabled).toBe(false);

    rerender(<FinanceDashboard parent="users/test" view="statistics" />);
    expect(screen.getByText("finance.insights.title")).toBeInTheDocument();
    expect(screen.queryByText("finance.dashboard.empty-today")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "finance.insights.more-history" }));
    expect(state.historyEnabled).toBe(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(<FinanceDashboard parent="users/test" view="records" />);
    expect(state.historyEnabled).toBe(false);
  });
});
