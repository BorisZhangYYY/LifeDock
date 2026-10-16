package test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestReminderListDeletionPreservesOnlyCompletedHistory(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	list, err := ts.CreateReminderList(ctx, &store.ReminderList{UID: "delete-list", CreatorID: user.ID, Name: "Original list"})
	require.NoError(t, err)
	for _, completed := range []bool{false, true} {
		uid, title, outcome := "unfinished", "Unfinished", store.ReminderOccurrenceSkipped
		if completed {
			uid, title, outcome = "finished", "Finished", store.ReminderOccurrenceCompletedOnTime
		}
		_, err := ts.CreateReminder(ctx, &store.Reminder{UID: uid, CreatorID: user.ID, ListID: list.ID, Title: title, TimeZone: "UTC"})
		require.NoError(t, err)
		_, err = ts.CreateReminderOccurrence(ctx, &store.ReminderOccurrence{
			UID: uid + "-occurrence", CreatorID: user.ID, ReminderUID: uid, ListUID: list.UID, ListName: list.Name,
			Title: title, ScheduledDate: "2026-10-15", CompletedTs: time.Now().Unix(), Status: outcome,
		})
		require.NoError(t, err)
	}
	require.NoError(t, ts.DeleteReminderList(ctx, &store.DeleteReminderList{ID: list.ID, CreatorID: user.ID}))
	lists, err := ts.ListReminderLists(ctx, &store.FindReminderList{CreatorID: &user.ID})
	require.NoError(t, err)
	require.Empty(t, lists)
	reminders, err := ts.ListReminders(ctx, &store.FindReminder{CreatorID: &user.ID})
	require.NoError(t, err)
	require.Empty(t, reminders)
	history, err := ts.ListReminderOccurrences(ctx, &store.FindReminderOccurrence{CreatorID: &user.ID})
	require.NoError(t, err)
	require.Len(t, history, 1)
	require.Equal(t, "Finished", history[0].Title)
	require.Equal(t, "Original list", history[0].ListName)
}
