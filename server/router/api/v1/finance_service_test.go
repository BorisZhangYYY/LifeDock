package v1

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/fieldmaskpb"
	"google.golang.org/protobuf/types/known/timestamppb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func TestFinanceServicePrivateLedgerAndSummary(t *testing.T) {
	ctx := context.Background()
	service := newIntegrationService(t)
	alice, err := service.Store.CreateUser(ctx, &store.User{Username: "finance-alice", Role: store.RoleUser})
	require.NoError(t, err)
	bob, err := service.Store.CreateUser(ctx, &store.User{Username: "finance-bob", Role: store.RoleAdmin})
	require.NoError(t, err)
	aliceCtx := userCtx(ctx, alice.ID)

	wallet, err := service.CreateFinanceWallet(aliceCtx, &v1pb.CreateFinanceWalletRequest{
		Parent: "users/finance-alice",
		Wallet: &v1pb.FinanceWallet{DisplayName: "CMB", InitialBalanceMinor: 5_000},
	})
	require.NoError(t, err)
	expenseCategory, err := service.CreateFinanceCategory(aliceCtx, &v1pb.CreateFinanceCategoryRequest{
		Parent:   "users/finance-alice",
		Category: &v1pb.FinanceCategory{DisplayName: "Drinks", Type: v1pb.FinanceCategory_EXPENSE, Emoji: "🥤"},
	})
	require.NoError(t, err)
	require.Equal(t, "🥤", expenseCategory.Emoji)
	incomeCategory, err := service.CreateFinanceCategory(aliceCtx, &v1pb.CreateFinanceCategoryRequest{
		Parent:   "users/finance-alice",
		Category: &v1pb.FinanceCategory{DisplayName: "Salary", Type: v1pb.FinanceCategory_INCOME},
	})
	require.NoError(t, err)
	expenseCategory, err = service.UpdateFinanceCategory(aliceCtx, &v1pb.UpdateFinanceCategoryRequest{
		Category:   &v1pb.FinanceCategory{Name: expenseCategory.Name, Emoji: "🍹"},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"emoji"}},
	})
	require.NoError(t, err)
	require.Equal(t, "🍹", expenseCategory.Emoji)
	categories, err := service.ListFinanceCategories(aliceCtx, &v1pb.ListFinanceCategoriesRequest{Parent: "users/finance-alice"})
	require.NoError(t, err)
	require.Contains(t, categories.Categories, expenseCategory)

	occurred := time.Date(2026, time.August, 9, 12, 0, 0, 0, time.FixedZone("UTC+8", 8*60*60))
	_, err = service.CreateFinanceTransaction(aliceCtx, &v1pb.CreateFinanceTransactionRequest{
		Parent: "users/finance-alice",
		Transaction: &v1pb.FinanceTransaction{
			Type: v1pb.FinanceTransaction_EXPENSE, AmountMinor: 1_299, Wallet: wallet.Name,
			Category: expenseCategory.Name, OccurTime: timestamppb.New(occurred),
		},
	})
	require.NoError(t, err)
	_, err = service.CreateFinanceTransaction(aliceCtx, &v1pb.CreateFinanceTransactionRequest{
		Parent: "users/finance-alice",
		Transaction: &v1pb.FinanceTransaction{
			Type: v1pb.FinanceTransaction_INCOME, AmountMinor: 2_500, Wallet: wallet.Name,
			Category: incomeCategory.Name, OccurTime: timestamppb.New(occurred),
		},
	})
	require.NoError(t, err)

	summary, err := service.GetFinanceSummary(aliceCtx, &v1pb.GetFinanceSummaryRequest{
		Parent: "users/finance-alice", TimeZone: "Asia/Shanghai",
		StartTime: timestamppb.New(time.Date(2026, time.August, 9, 0, 0, 0, 0, time.FixedZone("UTC+8", 8*60*60))),
		EndTime:   timestamppb.New(time.Date(2026, time.August, 10, 0, 0, 0, 0, time.FixedZone("UTC+8", 8*60*60))),
	})
	require.NoError(t, err)
	require.Equal(t, int64(6_201), summary.TotalBalanceMinor)
	require.Equal(t, int64(2_500), summary.IncomeMinor)
	require.Equal(t, int64(1_299), summary.ExpenseMinor)
	require.Equal(t, int64(1_201), summary.NetMinor)
	require.Len(t, summary.DailySummaries, 1)
	require.Equal(t, "2026-08-09", summary.DailySummaries[0].Date)

	adjustmentRequest := &v1pb.AdjustFinanceWalletBalanceRequest{
		Wallet: wallet.Name, ActualBalanceMinor: 6_000, Note: "bank reconciliation",
		OccurTime: timestamppb.New(occurred), RequestId: "finance-adjustment-request",
	}
	adjustment, err := service.AdjustFinanceWalletBalance(aliceCtx, adjustmentRequest)
	require.NoError(t, err)
	require.Equal(t, int64(-201), adjustment.AdjustmentDeltaMinor)
	require.Equal(t, int64(6_201), adjustment.BalanceBeforeMinor)
	require.Equal(t, int64(6_000), adjustment.BalanceAfterMinor)

	// A retried request is idempotent and must not apply the adjustment twice.
	retried, err := service.AdjustFinanceWalletBalance(aliceCtx, adjustmentRequest)
	require.NoError(t, err)
	require.Equal(t, adjustment.Name, retried.Name)
	wallets, err := service.ListFinanceWallets(aliceCtx, &v1pb.ListFinanceWalletsRequest{Parent: "users/finance-alice"})
	require.NoError(t, err)
	require.Equal(t, int64(6_000), wallets.Wallets[0].BalanceMinor)

	listed, err := service.ListFinanceTransactions(aliceCtx, &v1pb.ListFinanceTransactionsRequest{Parent: "users/finance-alice"})
	require.NoError(t, err)
	var expenseName string
	for _, transaction := range listed.Transactions {
		if transaction.Type == v1pb.FinanceTransaction_EXPENSE {
			expenseName = transaction.Name
		}
	}
	require.NotEmpty(t, expenseName)
	_, err = service.DeleteFinanceTransaction(aliceCtx, &v1pb.DeleteFinanceTransactionRequest{Name: expenseName})
	require.NoError(t, err)
	_, err = service.DeleteFinanceTransaction(aliceCtx, &v1pb.DeleteFinanceTransactionRequest{Name: expenseName})
	require.Equal(t, codes.NotFound, status.Code(err))
	listed, err = service.ListFinanceTransactions(aliceCtx, &v1pb.ListFinanceTransactionsRequest{Parent: "users/finance-alice"})
	require.NoError(t, err)
	for _, transaction := range listed.Transactions {
		require.NotEqual(t, expenseName, transaction.Name)
	}
	summary, err = service.GetFinanceSummary(aliceCtx, &v1pb.GetFinanceSummaryRequest{
		Parent: "users/finance-alice", TimeZone: "Asia/Shanghai",
		StartTime: timestamppb.New(time.Date(2026, time.August, 9, 0, 0, 0, 0, time.FixedZone("UTC+8", 8*60*60))),
		EndTime:   timestamppb.New(time.Date(2026, time.August, 10, 0, 0, 0, 0, time.FixedZone("UTC+8", 8*60*60))),
	})
	require.NoError(t, err)
	require.Zero(t, summary.ExpenseMinor)
	require.Equal(t, int64(2_500), summary.IncomeMinor)
	require.Equal(t, int64(6_000), summary.TotalBalanceMinor)

	_, err = service.ListFinanceWallets(userCtx(ctx, bob.ID), &v1pb.ListFinanceWalletsRequest{Parent: "users/finance-alice"})
	require.Equal(t, codes.PermissionDenied, status.Code(err))
}

func TestDeletedWalletRetainsTransactionsAndStatistics(t *testing.T) {
	ctx := context.Background()
	service := newIntegrationService(t)
	user, err := service.Store.CreateUser(ctx, &store.User{Username: "wallet-history", Role: store.RoleUser})
	require.NoError(t, err)
	actor := userCtx(ctx, user.ID)
	parent := "users/wallet-history"
	wallet, err := service.CreateFinanceWallet(actor, &v1pb.CreateFinanceWalletRequest{
		Parent: parent, Wallet: &v1pb.FinanceWallet{DisplayName: "Old wallet", InitialBalanceMinor: 10_000},
	})
	require.NoError(t, err)
	category, err := service.CreateFinanceCategory(actor, &v1pb.CreateFinanceCategoryRequest{
		Parent: parent, Category: &v1pb.FinanceCategory{DisplayName: "Food", Type: v1pb.FinanceCategory_EXPENSE},
	})
	require.NoError(t, err)
	now := time.Now().UTC()
	transaction, err := service.CreateFinanceTransaction(actor, &v1pb.CreateFinanceTransactionRequest{
		Parent: parent, Transaction: &v1pb.FinanceTransaction{Type: v1pb.FinanceTransaction_EXPENSE,
			AmountMinor: 1_200, Wallet: wallet.Name, Category: category.Name, OccurTime: timestamppb.New(now)},
	})
	require.NoError(t, err)
	_, err = service.DeleteFinanceWallet(actor, &v1pb.DeleteFinanceWalletRequest{Name: wallet.Name})
	require.Equal(t, codes.FailedPrecondition, status.Code(err), "an active wallet cannot be deleted")
	for _, state := range []v1pb.State{v1pb.State_ARCHIVED, v1pb.State_NORMAL, v1pb.State_ARCHIVED} {
		_, err = service.UpdateFinanceWallet(actor, &v1pb.UpdateFinanceWalletRequest{
			Wallet: &v1pb.FinanceWallet{Name: wallet.Name, State: state}, UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"state"}},
		})
		require.NoError(t, err)
	}
	_, err = service.DeleteFinanceWallet(actor, &v1pb.DeleteFinanceWalletRequest{Name: wallet.Name})
	require.NoError(t, err)
	wallets, err := service.ListFinanceWallets(actor, &v1pb.ListFinanceWalletsRequest{Parent: parent})
	require.NoError(t, err)
	require.Empty(t, wallets.Wallets)
	history, err := service.ListFinanceWallets(actor, &v1pb.ListFinanceWalletsRequest{Parent: parent, ShowDeleted: true})
	require.NoError(t, err)
	require.Len(t, history.Wallets, 1)
	require.NotNil(t, history.Wallets[0].DeleteTime)
	require.Equal(t, "Old wallet", history.Wallets[0].DisplayName)
	_, err = service.UpdateFinanceWallet(actor, &v1pb.UpdateFinanceWalletRequest{
		Wallet: &v1pb.FinanceWallet{Name: wallet.Name, State: v1pb.State_NORMAL}, UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"state"}},
	})
	require.Equal(t, codes.NotFound, status.Code(err), "a deleted wallet cannot be restored")
	_, err = service.CreateFinanceTransaction(actor, &v1pb.CreateFinanceTransactionRequest{
		Parent: parent, Transaction: &v1pb.FinanceTransaction{Type: v1pb.FinanceTransaction_EXPENSE,
			AmountMinor: 100, Wallet: wallet.Name, Category: category.Name, OccurTime: timestamppb.New(now)},
	})
	require.Equal(t, codes.NotFound, status.Code(err))
	listed, err := service.ListFinanceTransactions(actor, &v1pb.ListFinanceTransactionsRequest{Parent: parent})
	require.NoError(t, err)
	require.Len(t, listed.Transactions, 1)
	require.Equal(t, wallet.Name, listed.Transactions[0].Wallet)
	summaryRequest := &v1pb.GetFinanceSummaryRequest{Parent: parent, TimeZone: "UTC",
		StartTime: timestamppb.New(now.Add(-time.Hour)), EndTime: timestamppb.New(now.Add(time.Hour))}
	summary, err := service.GetFinanceSummary(actor, summaryRequest)
	require.NoError(t, err)
	require.Equal(t, int64(1_200), summary.ExpenseMinor, "wallet deletion keeps historical spending")
	require.Zero(t, summary.TotalBalanceMinor, "deleted wallet is excluded from current managed balances")
	_, err = service.DeleteFinanceTransaction(actor, &v1pb.DeleteFinanceTransactionRequest{Name: transaction.Name})
	require.NoError(t, err)
	summary, err = service.GetFinanceSummary(actor, summaryRequest)
	require.NoError(t, err)
	require.Zero(t, summary.ExpenseMinor, "deleting an erroneous entry removes its statistics")
	require.Empty(t, summary.DailySummaries)
	listed, err = service.ListFinanceTransactions(actor, &v1pb.ListFinanceTransactionsRequest{Parent: parent})
	require.NoError(t, err)
	require.Empty(t, listed.Transactions)
}
