package mcp

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/labstack/echo/v5"
	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stretchr/testify/require"
)

func TestActivitySummaryGroupsLocalDatesAndRetainedMoods(t *testing.T) {
	dates, err := parseActivityDateRange(map[string]any{"startDate": "2026-10-19", "endDate": "2026-10-21", "timeZone": "Asia/Shanghai"})
	require.NoError(t, err)
	summary, err := summarizeActivity(map[string]any{
		"memoCreatedTimestamps": []string{"2026-10-18T16:00:00Z", "2026-10-19T15:59:59Z", "2026-10-18T15:59:59Z"},
		// The second mood has no live memo, as after a memo deletion.
		"moodCreatedTimestamps": []string{"2026-10-18T16:00:00Z", "2026-10-19T16:00:00Z"},
		"moodLevels":            []int{1, 7},
	}, dates)
	require.NoError(t, err)
	require.Equal(t, 2, summary["memoCount"])
	require.Equal(t, 1, summary["activeDays"])
	require.Equal(t, 2, summary["moodCount"])
	require.Equal(t, []int{1, 0, 0, 0, 0, 0, 1}, summary["moodLevelCounts"])
	days := requireValueAs[[]any](t, summary["days"])
	require.Len(t, days, 3)
	require.Equal(t, 2, requireValueAs[map[string]any](t, days[0])["memoCount"])
	require.Equal(t, 0, requireValueAs[map[string]any](t, days[1])["memoCount"])
	require.Equal(t, 1, requireValueAs[map[string]any](t, days[1])["moodCount"])
	require.Equal(t, 0, requireValueAs[map[string]any](t, days[2])["moodCount"])

	// Validate the serialized wire value against the advertised output contract.
	encoded, err := json.Marshal(summary)
	require.NoError(t, err)
	var wire map[string]any
	require.NoError(t, json.Unmarshal(encoded, &wire))
	require.NoError(t, validateToolArguments(activitySummaryOutputSchema(), wire))
	require.NotContains(t, string(encoded), "memos/")
	require.NotContains(t, wire, "memoCreatedTimestamps")
}

func TestActivitySummaryDateRanges(t *testing.T) {
	for _, test := range []struct {
		name, start, end, zone string
		valid                  bool
	}{
		{"leap year", "2024-01-01", "2024-12-31", "UTC", true},
		{"daylight saving", "2026-03-07", "2026-03-09", "America/New_York", true},
		{"too long", "2024-01-01", "2025-01-01", "UTC", false},
		{"reversed", "2026-10-20", "2026-10-19", "UTC", false},
		{"invalid date", "2026-02-30", "2026-03-01", "UTC", false},
		{"missing zone", "2026-10-19", "2026-10-19", "", false},
		{"server zone", "2026-10-19", "2026-10-19", "Local", false},
		{"unknown zone", "2026-10-19", "2026-10-19", "Unknown/Zone", false},
	} {
		t.Run(test.name, func(t *testing.T) {
			dates, err := parseActivityDateRange(map[string]any{"startDate": test.start, "endDate": test.end, "timeZone": test.zone})
			if !test.valid {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			summary, err := summarizeActivity(map[string]any{}, dates)
			require.NoError(t, err)
			require.Zero(t, summary["memoCount"])
			if test.name == "daylight saving" {
				require.Len(t, summary["days"], 3)
			} else {
				require.Len(t, summary["days"], 366)
			}
		})
	}
}

func TestActivitySummaryRejectsMismatchedMoodRecords(t *testing.T) {
	dates, err := parseActivityDateRange(map[string]any{"startDate": "2026-10-19", "endDate": "2026-10-19", "timeZone": "UTC"})
	require.NoError(t, err)
	_, err = summarizeActivity(map[string]any{"moodLevels": []int{4}}, dates)
	require.ErrorContains(t, err, "do not match")
}

func TestActivitySummaryResponseSizeDoesNotGrowWithIndividualRecords(t *testing.T) {
	dates, err := parseActivityDateRange(map[string]any{"startDate": "2026-10-19", "endDate": "2026-10-19", "timeZone": "UTC"})
	require.NoError(t, err)
	timestamps := make([]string, 10000)
	for i := range timestamps {
		timestamps[i] = "2026-10-19T12:00:00Z"
	}
	stats := map[string]any{"memoCreatedTimestamps": timestamps}
	summary, err := summarizeActivity(stats, dates)
	require.NoError(t, err)
	require.Equal(t, 10000, summary["memoCount"])
	full, err := json.Marshal(stats)
	require.NoError(t, err)
	compact, err := json.Marshal(summary)
	require.NoError(t, err)
	require.Less(t, len(compact), len(full)/100)
}

func TestActivitySummaryUsesAuthenticatedUserAndRejectsOverrides(t *testing.T) {
	e := echo.New()
	hits := 0
	e.GET("/api/v1/auth/me", func(c *echo.Context) error {
		hits++
		require.Equal(t, "Bearer owner", c.Request().Header.Get("Authorization"))
		return c.JSON(http.StatusOK, map[string]any{"user": map[string]any{"name": "users/owner"}})
	})
	e.GET("/api/v1/users/:user:getStats", func(c *echo.Context) error {
		require.Equal(t, "Bearer owner", c.Request().Header.Get("Authorization"))
		return c.JSON(http.StatusOK, map[string]any{"memoCreatedTimestamps": []string{"2026-10-19T01:00:00Z"}})
	})
	spec, err := loadMCPServiceOpenAPISpec()
	require.NoError(t, err)
	registry, err := buildOperationRegistry(spec)
	require.NoError(t, err)
	_, handler, err := newActivitySummaryTool(newAPIAdapter(e), registry["UserService_GetUserStats"])
	require.NoError(t, err)
	call := func(arguments string) *sdkmcp.CallToolResult {
		result, err := handler(context.Background(), &sdkmcp.CallToolRequest{
			Params: &sdkmcp.CallToolParamsRaw{Arguments: json.RawMessage(arguments)},
			Extra:  &sdkmcp.RequestExtra{Header: http.Header{"Authorization": []string{"Bearer owner"}}},
		})
		require.NoError(t, err)
		return result
	}
	result := call(`{"startDate":"2026-10-19","endDate":"2026-10-19","timeZone":"UTC","user":"users/other"}`)
	require.True(t, result.IsError)
	require.Zero(t, hits)
	result = call(`{"startDate":"2026-10-19","endDate":"2026-10-19","timeZone":"UTC"}`)
	require.False(t, result.IsError, "%v", result.Content)
	require.Equal(t, 1, requireValueAs[map[string]any](t, result.StructuredContent)["memoCount"])
	require.Equal(t, 1, hits)
}
