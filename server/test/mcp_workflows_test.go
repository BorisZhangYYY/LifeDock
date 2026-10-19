package test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// mcpCall uses the real HTTP transport, gateway, auth and SQLite store. A tool
// failure stays distinct from transport or JSON-RPC errors.
func (i *instance) mcpCall(t *testing.T, token, name string, arguments map[string]any, wantError bool) map[string]any {
	t.Helper()
	data, err := json.Marshal(map[string]any{
		"jsonrpc": "2.0", "id": 1, "method": "tools/call",
		"params": map[string]any{"name": name, "arguments": arguments},
	})
	require.NoError(t, err)
	req, err := http.NewRequestWithContext(t.Context(), http.MethodPost, i.baseURL+"/mcp", bytes.NewReader(data))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	response, err := i.client.Do(req)
	require.NoError(t, err)
	defer response.Body.Close()
	require.Equal(t, http.StatusOK, response.StatusCode)
	var envelope struct {
		Error  any `json:"error"`
		Result struct {
			IsError           bool             `json:"isError"`
			Content           []map[string]any `json:"content"`
			StructuredContent map[string]any   `json:"structuredContent"`
		} `json:"result"`
	}
	require.NoError(t, json.NewDecoder(response.Body).Decode(&envelope))
	require.Nil(t, envelope.Error, "%s: %v", name, envelope.Error)
	require.Equal(t, wantError, envelope.Result.IsError, "%s: %v", name, envelope.Result.Content)
	if wantError {
		require.Nil(t, envelope.Result.StructuredContent)
		return nil
	}
	require.NotNil(t, envelope.Result.StructuredContent)
	return envelope.Result.StructuredContent
}

func TestMCPPersonalWorkflows(t *testing.T) {
	inst := bootInstance(context.Background(), t, instanceOptions{})
	inst.createAdmin(t)
	token := inst.signIn(t)
	now := time.Now().UTC()
	rangeArgs := map[string]any{
		"startDate": now.AddDate(0, 0, -7).Format(time.DateOnly), "endDate": now.AddDate(0, 0, 1).Format(time.DateOnly),
	}
	call := func(t *testing.T, name string, arguments map[string]any) map[string]any {
		return inst.mcpCall(t, token, name, arguments, false)
	}
	t.Run("reminder history survives cleanup", func(t *testing.T) {
		list := call(t, "reminder_create_reminder_list", map[string]any{"body": map[string]any{"displayName": "Weekly review"}})
		reminder := call(t, "reminder_create_reminder", map[string]any{"body": map[string]any{
			"title": "Daily review", "reminderList": list["name"], "dueDate": now.AddDate(0, 0, -2).Format(time.DateOnly),
			"timeZone": "UTC", "recurrence": map[string]any{"frequency": "DAILY", "interval": 1},
		}})
		completed := call(t, "reminder_complete_reminder", map[string]any{"reminder": reminder["name"], "body": map[string]any{}})
		require.Equal(t, now.AddDate(0, 0, 1).Format(time.DateOnly), completed["dueDate"])
		require.Equal(t, float64(1), completed["completedOccurrences"])
		before := call(t, "reminder_get_reminder_stats", rangeArgs)
		require.Equal(t, float64(3), before["totalCount"])
		require.Equal(t, float64(1), before["completedOnTimeCount"])
		require.Equal(t, float64(2), before["skippedCount"])
		call(t, "reminder_delete_reminder_list", map[string]any{"reminderList": list["name"]})
		after := call(t, "reminder_get_reminder_stats", rangeArgs)
		require.Equal(t, before, after)
		history, ok := call(t, "reminder_list_reminder_occurrences", rangeArgs)["reminderOccurrences"].([]any)
		require.True(t, ok)
		require.Len(t, history, 3)
		first, ok := history[0].(map[string]any)
		require.True(t, ok)
		require.Equal(t, "Daily review", first["title"])
		// A neighboring range must not accidentally include retained history.
		empty := call(t, "reminder_get_reminder_stats", map[string]any{"startDate": "2000-01-01", "endDate": "2000-01-02"})
		require.Equal(t, float64(0), empty["totalCount"])
	})
	t.Run("ledger balances follow corrections and deletion", func(t *testing.T) {
		wallet := call(t, "finance_create_finance_wallet", map[string]any{"body": map[string]any{"displayName": "Cash", "initialBalanceMinor": "10000"}})
		category := call(t, "finance_create_finance_category", map[string]any{"body": map[string]any{"displayName": "Dining", "type": "EXPENSE"}})
		transaction := call(t, "finance_create_finance_transaction", map[string]any{"body": map[string]any{
			"type": "EXPENSE", "wallet": wallet["name"], "category": category["name"], "amountMinor": "1234", "occurTime": now.Format(time.RFC3339),
		}})
		financeRange := map[string]any{
			"startTime": now.Add(-24 * time.Hour).Format(time.RFC3339), "endTime": now.Add(24 * time.Hour).Format(time.RFC3339), "timeZone": "UTC",
		}
		summary := call(t, "finance_get_finance_summary", financeRange)
		require.Equal(t, "8766", summary["totalBalanceMinor"])
		require.Equal(t, "1234", summary["expenseMinor"])
		call(t, "finance_update_finance_transaction", map[string]any{
			"financeTransaction": transaction["name"], "updateMask": "amount_minor", "body": map[string]any{"amountMinor": "2000"},
		})
		require.Equal(t, "8000", call(t, "finance_get_finance_summary", financeRange)["totalBalanceMinor"])
		call(t, "finance_delete_finance_transaction", map[string]any{"financeTransaction": transaction["name"]})
		summary = call(t, "finance_get_finance_summary", financeRange)
		require.Equal(t, "10000", summary["totalBalanceMinor"])
		require.Equal(t, "0", summary["expenseMinor"])
	})
	t.Run("compact summary retains deleted moods without activity", func(t *testing.T) {
		memo := call(t, "memo_create_memo", map[string]any{"body": map[string]any{"content": "Daily mood", "moodLevel": 6, "visibility": "PRIVATE"}})
		call(t, "memo_delete_memo", map[string]any{"memo": memo["name"]})
		result := call(t, "user_get_activity_summary", map[string]any{
			"startDate": now.Format(time.DateOnly), "endDate": now.Format(time.DateOnly), "timeZone": "UTC",
		})
		require.Equal(t, float64(0), result["memoCount"])
		require.Equal(t, float64(1), result["moodCount"])
		require.NotContains(t, result, "moodMemoNames")
	})
	t.Run("private statistics stay with the authenticated user", func(t *testing.T) {
		status, body := inst.do(t, http.MethodPost, "/api/v1/users", token, map[string]any{
			"username": "mcp-other", "password": "another-password", "email": "mcp-other@example.test", "role": "USER",
		})
		require.Equal(t, http.StatusOK, status, "%s", body)
		status, body = inst.do(t, http.MethodPost, "/api/v1/auth/signin", "", map[string]any{
			"passwordCredentials": map[string]any{"username": "mcp-other", "password": "another-password"},
		})
		require.Equal(t, http.StatusOK, status, "%s", body)
		var signedIn struct {
			AccessToken string `json:"accessToken"`
		}
		require.NoError(t, json.Unmarshal(body, &signedIn))
		stats := inst.mcpCall(t, signedIn.AccessToken, "reminder_get_reminder_stats", rangeArgs, false)
		require.Equal(t, float64(0), stats["totalCount"])
		inst.mcpCall(t, signedIn.AccessToken, "reminder_get_reminder_stats", map[string]any{"user": "users/" + testAdminUsername}, true)
		inst.mcpCall(t, "", "reminder_get_reminder_stats", rangeArgs, true)
		activity := inst.mcpCall(t, signedIn.AccessToken, "user_get_activity_summary", map[string]any{
			"startDate": now.Format(time.DateOnly), "endDate": now.Format(time.DateOnly), "timeZone": "UTC",
		}, false)
		require.Equal(t, float64(0), activity["moodCount"])
	})
}
