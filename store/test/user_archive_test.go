package test

import (
	"context"
	"encoding/json"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestUserArchiveRoundTripPersonalData(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	source, err := ts.CreateUser(ctx, &store.User{Username: "source", Nickname: "Source profile", Role: store.RoleUser})
	require.NoError(t, err)
	target, err := ts.CreateUser(ctx, &store.User{Username: "target", Role: store.RoleUser})
	require.NoError(t, err)
	_, err = ts.UpsertUserSetting(ctx, &storepb.UserSetting{UserId: source.ID, Key: storepb.UserSetting_GENERAL, Value: &storepb.UserSetting_General{General: &storepb.GeneralUserSetting{Locale: "zh-Hans", DisableFinance: true, RequirePasswordForPrivateContent: true}}})
	require.NoError(t, err)
	_, err = ts.UpsertUserSetting(ctx, &storepb.UserSetting{UserId: source.ID, Key: storepb.UserSetting_REFRESH_TOKENS, Value: &storepb.UserSetting_RefreshTokens{RefreshTokens: &storepb.RefreshTokensUserSetting{}}})
	require.NoError(t, err)
	wallet, err := ts.CreateFinanceWallet(ctx, &store.FinanceWallet{UID: "archive-wallet", CreatorID: source.ID, Name: "Bank", InitialBalanceMinor: 9_000_000_000_001})
	require.NoError(t, err)
	category, err := ts.CreateFinanceCategory(ctx, &store.FinanceCategory{UID: "archive-category", CreatorID: source.ID, Name: "Food", Type: store.FinanceCategoryExpense})
	require.NoError(t, err)
	transaction, err := ts.CreateFinanceTransaction(ctx, &store.FinanceTransaction{UID: "archive-transaction", CreatorID: source.ID, OccurredTs: time.Now().Unix(), Type: store.FinanceTransactionExpense, AmountMinor: 123, WalletID: wallet.ID, CategoryID: &category.ID})
	require.NoError(t, err)
	list, err := ts.CreateReminderList(ctx, &store.ReminderList{UID: "archive-list", CreatorID: source.ID, Name: "Work"})
	require.NoError(t, err)
	memo, err := ts.CreateMemo(ctx, &store.Memo{UID: "archive-memo", CreatorID: source.ID, Content: "mood", Visibility: store.Private, Payload: &storepb.MemoPayload{MoodLevel: 6}})
	require.NoError(t, err)
	reminder, err := ts.CreateReminder(ctx, &store.Reminder{UID: "archive-list", CreatorID: source.ID, ListID: list.ID, MemoID: &memo.ID, Title: "Recurring", RecurrenceType: store.ReminderRecurrenceWeekly, RecurrenceInterval: 2, RecurrenceWeekdays: []int32{1, 3}, Status: store.ReminderPending})
	require.NoError(t, err)
	_, err = ts.CreateReminderOccurrence(ctx, &store.ReminderOccurrence{UID: "archive-occurrence", CreatorID: source.ID, ReminderUID: reminder.UID, ListUID: list.UID, ListName: list.Name, Title: reminder.Title, MemoUID: memo.UID, ScheduledDate: "2026-10-20", CompletedTs: time.Now().Unix(), CompletionDate: "2026-10-20", Status: store.ReminderOccurrenceCompletedLate})
	require.NoError(t, err)
	_, err = ts.CreateInbox(ctx, &store.Inbox{SenderID: source.ID, ReceiverID: source.ID, Status: store.UNREAD, Message: &storepb.InboxMessage{Type: storepb.InboxMessage_REMINDER, Payload: &storepb.InboxMessage_Reminder{Reminder: &storepb.InboxMessage_ReminderPayload{ReminderId: reminder.ID, ReminderUid: reminder.UID, Title: reminder.Title}}}})
	require.NoError(t, err)
	deletedMemo, err := ts.CreateMemo(ctx, &store.Memo{UID: "deleted-mood", CreatorID: source.ID, Visibility: store.Private, Payload: &storepb.MemoPayload{MoodLevel: 4}})
	require.NoError(t, err)
	require.NoError(t, ts.DeleteMemo(ctx, &store.DeleteMemo{ID: deletedMemo.ID}))
	archived := store.Archived
	_, err = ts.UpdateFinanceWallet(ctx, &store.UpdateFinanceWallet{ID: wallet.ID, CreatorID: source.ID, RowStatus: &archived})
	require.NoError(t, err)
	require.NoError(t, ts.DeleteFinanceWallet(ctx, &store.DeleteFinanceWallet{ID: wallet.ID, CreatorID: source.ID}))
	snapshot, err := ts.ExportUserArchiveData(ctx, source.ID)
	require.NoError(t, err)
	snapshot.MemoUIDs = map[string]string{strconv.Itoa(int(memo.ID)): memo.UID}
	require.Len(t, snapshot.Tables["settings"], 1, "login credentials must not be exported")
	// Exercise the exact JSON representation sent in archives without float rounding.
	raw, err := json.Marshal(snapshot)
	require.NoError(t, err)
	snapshot, err = store.DecodeUserArchiveData(raw)
	require.NoError(t, err)
	targetMemo, err := ts.CreateMemo(ctx, &store.Memo{UID: "target-memo", CreatorID: target.ID, Content: "restored", Visibility: store.Private})
	require.NoError(t, err)
	result, err := ts.ImportUserArchiveData(ctx, target.ID, snapshot, "REPLACE", map[string]int32{memo.UID: targetMemo.ID})
	require.NoError(t, err)
	require.Positive(t, result.Created+result.Updated)
	wallets, err := ts.ListFinanceWallets(ctx, &store.FindFinanceWallet{CreatorID: &target.ID, IncludeDeleted: true})
	require.NoError(t, err)
	require.Len(t, wallets, 1)
	require.Equal(t, int64(9_000_000_000_001-123), wallets[0].BalanceMinor)
	require.NotNil(t, wallets[0].DeletedTs)
	txs, err := ts.ListFinanceTransactions(ctx, &store.FindFinanceTransaction{CreatorID: &target.ID})
	require.NoError(t, err)
	require.Len(t, txs, 1)
	require.Equal(t, wallets[0].ID, txs[0].WalletID)
	require.Equal(t, transaction.BalanceBeforeMinor, txs[0].BalanceBeforeMinor)
	reminders, err := ts.ListReminders(ctx, &store.FindReminder{CreatorID: &target.ID})
	require.NoError(t, err)
	require.Len(t, reminders, 1)
	require.Equal(t, &targetMemo.ID, reminders[0].MemoID)
	require.Equal(t, []int32{1, 3}, reminders[0].RecurrenceWeekdays)
	occurrences, err := ts.ListReminderOccurrences(ctx, &store.FindReminderOccurrence{CreatorID: &target.ID})
	require.NoError(t, err)
	require.Len(t, occurrences, 1)
	require.Equal(t, reminders[0].UID, occurrences[0].ReminderUID)
	require.Equal(t, targetMemo.UID, occurrences[0].MemoUID)
	lists, err := ts.ListReminderLists(ctx, &store.FindReminderList{CreatorID: &target.ID})
	require.NoError(t, err)
	require.Len(t, lists, 1)
	require.Equal(t, lists[0].UID, occurrences[0].ListUID)
	notifications, err := ts.ListInboxes(ctx, &store.FindInbox{ReceiverID: &target.ID})
	require.NoError(t, err)
	require.Len(t, notifications, 1)
	require.Equal(t, target.ID, notifications[0].SenderID)
	require.Equal(t, reminders[0].ID, notifications[0].Message.GetReminder().ReminderId)
	require.Equal(t, reminders[0].UID, notifications[0].Message.GetReminder().ReminderUid)
	history, err := ts.ListDeletedMemoMoodHistory(ctx, target.ID)
	require.NoError(t, err)
	require.Len(t, history, 1)
	require.EqualValues(t, 4, history[0].MoodLevel)
	restored, err := ts.GetUser(ctx, &store.FindUser{ID: &target.ID})
	require.NoError(t, err)
	require.Equal(t, "Source profile", restored.Nickname)
	require.Equal(t, "target", restored.Username)
	settings, err := ts.GetUserSetting(ctx, &store.FindUserSetting{UserID: &target.ID, Key: storepb.UserSetting_GENERAL})
	require.NoError(t, err)
	require.True(t, settings.GetGeneral().DisableFinance)
	skipped, err := ts.ImportUserArchiveData(ctx, target.ID, snapshot, "SKIP", map[string]int32{})
	require.NoError(t, err)
	require.Positive(t, skipped.Skipped)
	require.Zero(t, skipped.Created)
	_, err = ts.ImportUserArchiveData(ctx, target.ID, snapshot, "DUPLICATE", map[string]int32{})
	require.NoError(t, err)
	wallets, err = ts.ListFinanceWallets(ctx, &store.FindFinanceWallet{CreatorID: &target.ID, IncludeDeleted: true})
	require.NoError(t, err)
	require.Len(t, wallets, 2)
	// Invalid lifecycle values are rejected consistently across all databases.
	originalStatus := snapshot.Tables["wallets"][0]["row_status"]
	snapshot.Tables["wallets"][0]["row_status"] = "INVALID"
	_, err = ts.ImportUserArchiveData(ctx, target.ID, snapshot, "REPLACE", nil)
	require.Error(t, err)
	snapshot.Tables["wallets"][0]["row_status"] = originalStatus
	// A uniqueness failure after replacement has started must roll back the collection.
	duplicateWallet := store.UserArchiveRow{}
	for key, value := range snapshot.Tables["wallets"][0] {
		duplicateWallet[key] = value
	}
	duplicateWallet["id"] = json.Number("2147483647")
	snapshot.Tables["wallets"] = append(snapshot.Tables["wallets"], duplicateWallet)
	_, err = ts.ImportUserArchiveData(ctx, target.ID, snapshot, "REPLACE", nil)
	require.Error(t, err)
	wallets, err = ts.ListFinanceWallets(ctx, &store.FindFinanceWallet{CreatorID: &target.ID, IncludeDeleted: true})
	require.NoError(t, err)
	require.Len(t, wallets, 2)
	sourceWallets, err := ts.ListFinanceWallets(ctx, &store.FindFinanceWallet{CreatorID: &source.ID, IncludeDeleted: true})
	require.NoError(t, err)
	require.Len(t, sourceWallets, 1)
}
