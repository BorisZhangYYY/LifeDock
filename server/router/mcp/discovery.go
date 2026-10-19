package mcp

import (
	"net/url"
	"strings"

	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/pkg/errors"
)

// Examples are annotations only; defaults are never silently injected into
// mutations. Keep money in integer minor units and dates explicit.
var operationInputExamples = map[string][]any{
	"MemoService_ListMemos": {map[string]any{"filter": `"work" in tags`, "pageSize": 20}},
	"ReminderService_CreateReminder": {map[string]any{"body": map[string]any{
		"title": "Review weekly plan", "reminderList": "users/alex/reminderLists/work", "dueDate": "2026-10-19", "timeZone": "Asia/Shanghai",
	}}},
	"ReminderService_UpdateReminder": {map[string]any{
		"reminder": "users/alex/reminders/review", "updateMask": "due_date", "body": map[string]any{"dueDate": "2026-10-20"},
	}},
	"ReminderService_GetReminderStats":        {map[string]any{"startDate": "2026-10-01", "endDate": "2026-10-31"}},
	"ReminderService_ListReminderOccurrences": {map[string]any{"startDate": "2026-10-01", "endDate": "2026-10-31"}},
	"FinanceService_CreateFinanceTransaction": {map[string]any{"body": map[string]any{
		"type": "EXPENSE", "wallet": "users/alex/wallets/cash", "category": "users/alex/financeCategories/dining",
		"amountMinor": "1234", "occurTime": "2026-10-19T12:00:00+08:00",
	}}},
	"FinanceService_GetFinanceSummary": {map[string]any{
		"startTime": "2026-10-01T00:00:00+08:00", "endTime": "2026-11-01T00:00:00+08:00", "timeZone": "Asia/Shanghai",
	}},
}

func toolCategory(operationID string) string {
	switch operationID {
	case "MemoService_SetMemoMood", "InstanceService_GetMemoMoodDisplay", "InstanceService_UpdateMemoMoodDisplay":
		return "mood"
	case "UserService_GetUserStats":
		return "statistics"
	case "InstanceService_GetInstanceStats":
		return "administration"
	}
	service, _, _ := strings.Cut(operationID, "_")
	switch service {
	case "MemoService":
		return "notes"
	case "AttachmentService":
		return "attachments"
	case "MemoViewService":
		return "views"
	case "ShortcutService":
		return "legacy"
	case "SpaceService":
		return "spaces"
	case "ReminderService":
		return "reminders"
	case "FinanceService":
		return "finance"
	case "UserService":
		return "settings"
	case "AuthService":
		return "identity"
	default:
		return "other"
	}
}

func requestedToolProfile(query url.Values) (string, error) {
	values, ok := query["profile"]
	if !ok {
		return "all", nil
	}
	if len(values) == 1 {
		switch values[0] {
		case "all", "notes", "personal":
			return values[0], nil
		}
	}
	return "", errors.New("MCP profile must be one of: all, notes, personal")
}

// Profiles reduce model discovery overhead, not API permissions. Every tool
// call still authenticates through the original API, and /mcp remains complete.
func toolInProfile(tool *sdkmcp.Tool, profile string) bool {
	if profile == "all" {
		return true
	}
	category, ok := tool.Meta["category"].(string)
	if !ok {
		return false
	}
	if category == "identity" || category == "statistics" {
		return true
	}
	switch profile {
	case "notes":
		return category == "notes" || category == "attachments" || category == "views" || category == "spaces" || category == "mood"
	case "personal":
		if category == "reminders" || category == "finance" || category == "mood" || category == "settings" {
			return true
		}
		switch tool.Name {
		case "memo_list_memos", "memo_get_memo", "memo_create_memo", "memo_update_memo":
			return true
		default:
			return false
		}
	default:
		return false
	}
}
