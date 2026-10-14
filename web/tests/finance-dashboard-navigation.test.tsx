import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FinanceDashboard from "@/components/Finance/FinanceDashboard";

const state = vi.hoisted(() => ({ historyEnabled: false }));
vi.mock("@/hooks/useFinanceQueries", () => ({
  useFinanceWallets: () => ({ data: [{ name: "users/test/wallets/one", displayName: "Wallet", balanceMinor: 100n }] }),
  useFinanceCategories: () => ({ data: [] }),
  useFinanceSummary: () => ({ data: undefined }),
  useFinanceTransactions: () => ({ data: [] }),
  useFinanceTransactionHistory: (_parent: string, enabled: boolean) => {
    state.historyEnabled = enabled;
    return { data: [], isLoading: false };
  },
  useVoidFinanceTransaction: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

describe("finance page sections", () => {
  beforeEach(() => {
    state.historyEnabled = false;
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
