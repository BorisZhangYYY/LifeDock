package mcp

import (
	"context"
	"encoding/json"
	"time"

	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/pkg/errors"
)

const activitySummaryToolName = "user_get_activity_summary"

type activityDateRange struct {
	start, end time.Time
	location   *time.Location
}

type activityDay struct {
	memoCount, moodCount int
	moodLevelCounts      []int
}

// This is a presentation of GetUserStats, not a separate data source. The API
// remains responsible for access checks and retained mood-history semantics.
func newActivitySummaryTool(adapter *apiAdapter, source *openAPIOperation) (*sdkmcp.Tool, sdkmcp.ToolHandler, error) {
	if source == nil || !usesImplicitCurrentUser(source) {
		return nil, nil, errors.New("activity summary requires the user-scoped GetUserStats operation")
	}
	input := jsonSchema{
		"type": "object", "additionalProperties": false,
		"properties": map[string]any{
			"startDate": jsonSchema{"type": "string", "format": "date", "description": "Inclusive first date, YYYY-MM-DD."},
			"endDate":   jsonSchema{"type": "string", "format": "date", "description": "Inclusive last date, YYYY-MM-DD. At most 366 days."},
			"timeZone":  jsonSchema{"type": "string", "description": "IANA time zone used to group dates, for example Asia/Shanghai. Required; never inferred from the server."},
		},
		"required": []string{"startDate", "endDate", "timeZone"},
		"examples": []any{map[string]any{"startDate": "2026-10-01", "endDate": "2026-10-31", "timeZone": "Asia/Shanghai"}},
	}
	validator, err := compileToolArgumentValidator(input)
	if err != nil {
		return nil, nil, err
	}
	tool := &sdkmcp.Tool{
		Name: activitySummaryToolName, Title: "Daily Memo and Mood Summary",
		Description: "Review the current user's daily memo counts and seven-level mood distribution in a bounded date range, without individual timestamps or memo names. Includes retained moods of deleted memos; deleted memos do not count as activity. Counts normal top-level memos by creation date. All dates, including empty days, use the explicit timeZone. For tags or individual records, use user_get_user_stats.",
		InputSchema: input, OutputSchema: activitySummaryOutputSchema(),
		Meta:        sdkmcp.Meta{"category": "statistics", "operationId": source.OperationID, "method": source.Method, "path": source.Path},
		Annotations: annotationsForMethod("GET", "Daily Memo and Mood Summary"),
	}
	handler := func(ctx context.Context, request *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
		arguments := map[string]any{}
		if request.Params != nil && len(request.Params.Arguments) > 0 {
			if err := json.Unmarshal(request.Params.Arguments, &arguments); err != nil {
				return newToolErrorResult(errors.Wrap(err, "failed to decode activity summary arguments").Error()), nil
			}
		}
		if err := validator.validate(arguments); err != nil {
			return newToolErrorResult(err.Error()), nil
		}
		dates, err := parseActivityDateRange(arguments)
		if err != nil {
			return newToolErrorResult(err.Error()), nil
		}
		authorization := ""
		if request.Extra != nil {
			authorization = request.Extra.Header.Get("Authorization")
		}
		user, err := adapter.resolveCurrentUserName(ctx, authorization)
		if err != nil {
			return newToolErrorResult(err.Error()), nil
		}
		value, err := adapter.executeJSON(ctx, source, map[string]any{"user": user}, authorization)
		if err != nil {
			return newToolErrorResult(err.Error()), nil
		}
		summary, err := summarizeActivity(value, dates)
		if err != nil {
			return newToolErrorResult(err.Error()), nil
		}
		return newStructuredToolResult(summary)
	}
	return tool, handler, nil
}

func parseActivityDateRange(arguments map[string]any) (activityDateRange, error) {
	startDate, ok := arguments["startDate"].(string)
	if !ok {
		return activityDateRange{}, errors.New("startDate must be a string")
	}
	endDate, ok := arguments["endDate"].(string)
	if !ok {
		return activityDateRange{}, errors.New("endDate must be a string")
	}
	zone, ok := arguments["timeZone"].(string)
	if !ok {
		return activityDateRange{}, errors.New("timeZone must be a string")
	}
	start, end, err := parseCalendarDateRange(startDate, endDate)
	if err != nil {
		return activityDateRange{}, err
	}
	if zone == "" || zone == "Local" {
		return activityDateRange{}, errors.New("timeZone must be an explicit IANA time zone")
	}
	location, err := time.LoadLocation(zone)
	if err != nil {
		return activityDateRange{}, errors.New("timeZone must be a valid IANA time zone, for example Asia/Shanghai")
	}
	return activityDateRange{start: start, end: end, location: location}, nil
}

func parseCalendarDateRange(startDate, endDate string) (time.Time, time.Time, error) {
	start, err := time.Parse(time.DateOnly, startDate)
	if err != nil {
		return time.Time{}, time.Time{}, errors.New("startDate must be a valid YYYY-MM-DD date")
	}
	end, err := time.Parse(time.DateOnly, endDate)
	if err != nil {
		return time.Time{}, time.Time{}, errors.New("endDate must be a valid YYYY-MM-DD date")
	}
	// Count calendar days in UTC; grouping uses the chosen location below. This
	// also keeps daylight-saving transitions from changing the range limit.
	if end.Before(start) || end.Sub(start) >= 366*24*time.Hour {
		return time.Time{}, time.Time{}, errors.New("endDate must be on or after startDate and the range must not exceed 366 days")
	}
	return start, end, nil
}

func summarizeActivity(value any, dates activityDateRange) (map[string]any, error) {
	if _, ok := value.(map[string]any); !ok {
		return nil, errors.New("activity statistics response must be an object")
	}
	data, err := json.Marshal(value)
	if err != nil {
		return nil, errors.Wrap(err, "failed to encode activity statistics")
	}
	var stats struct {
		MemoCreatedTimestamps []time.Time `json:"memoCreatedTimestamps"`
		MoodCreatedTimestamps []time.Time `json:"moodCreatedTimestamps"`
		MoodLevels            []int       `json:"moodLevels"`
	}
	if err := json.Unmarshal(data, &stats); err != nil {
		return nil, errors.Wrap(err, "failed to decode activity statistics")
	}
	if len(stats.MoodLevels) != len(stats.MoodCreatedTimestamps) {
		return nil, errors.New("mood levels and timestamps do not match")
	}
	dateKeys := []string{}
	byDate := map[string]*activityDay{}
	for day := dates.start; !day.After(dates.end); day = day.AddDate(0, 0, 1) {
		date := day.Format(time.DateOnly)
		byDate[date] = &activityDay{moodLevelCounts: make([]int, 7)}
		dateKeys = append(dateKeys, date)
	}
	memoCount, moodCount, activeDays := 0, 0, 0
	moodCounts := make([]int, 7)
	for _, timestamp := range stats.MemoCreatedTimestamps {
		if bucket := byDate[timestamp.In(dates.location).Format(time.DateOnly)]; bucket != nil {
			if bucket.memoCount == 0 {
				activeDays++
			}
			bucket.memoCount++
			memoCount++
		}
	}
	for i, timestamp := range stats.MoodCreatedTimestamps {
		level := stats.MoodLevels[i]
		if level < 1 || level > 7 {
			return nil, errors.New("mood level must be between 1 and 7")
		}
		if bucket := byDate[timestamp.In(dates.location).Format(time.DateOnly)]; bucket != nil {
			bucket.moodCount++
			bucket.moodLevelCounts[level-1]++
			moodCounts[level-1]++
			moodCount++
		}
	}
	days := make([]any, 0, len(dateKeys))
	for _, date := range dateKeys {
		bucket := byDate[date]
		days = append(days, map[string]any{
			"date": date, "memoCount": bucket.memoCount, "moodCount": bucket.moodCount, "moodLevelCounts": bucket.moodLevelCounts,
		})
	}
	return map[string]any{
		"startDate": dates.start.Format(time.DateOnly), "endDate": dates.end.Format(time.DateOnly), "timeZone": dates.location.String(),
		"memoCount": memoCount, "activeDays": activeDays, "moodCount": moodCount, "moodLevelCounts": moodCounts, "days": days,
	}, nil
}

func activitySummaryOutputSchema() jsonSchema {
	count := jsonSchema{"type": "integer", "minimum": 0}
	levels := jsonSchema{
		"type": "array", "items": count, "minItems": 7, "maxItems": 7,
		"description": "Seven counts ordered by mood level 1 through 7; index 0 is level 1.",
	}
	return jsonSchema{
		"type": "object", "additionalProperties": false,
		"properties": map[string]any{
			"startDate": jsonSchema{"type": "string"}, "endDate": jsonSchema{"type": "string"}, "timeZone": jsonSchema{"type": "string"},
			"memoCount": count, "activeDays": count, "moodCount": count, "moodLevelCounts": levels,
			"days": jsonSchema{"type": "array", "maxItems": 366, "items": jsonSchema{
				"type": "object", "additionalProperties": false,
				"properties": map[string]any{
					"date": jsonSchema{"type": "string"}, "memoCount": count, "moodCount": count, "moodLevelCounts": levels,
				},
				"required": []string{"date", "memoCount", "moodCount", "moodLevelCounts"},
			}},
		},
		"required": []string{"startDate", "endDate", "timeZone", "memoCount", "activeDays", "moodCount", "moodLevelCounts", "days"},
	}
}
