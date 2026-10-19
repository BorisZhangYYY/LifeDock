package mcp

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/profile"
)

func TestDiscoveryExamplesMatchToolInputs(t *testing.T) {
	spec, err := loadMCPServiceOpenAPISpec()
	require.NoError(t, err)
	registry, err := buildOperationRegistry(spec)
	require.NoError(t, err)
	for operationID, examples := range operationInputExamples {
		t.Run(operationID, func(t *testing.T) {
			operation := registry[operationID]
			require.NotNil(t, operation)
			tool, _ := buildToolFromOperation(operation)
			for _, example := range examples {
				require.NoError(t, validateToolArguments(requireValueAs[jsonSchema](t, tool.InputSchema), requireValueAs[map[string]any](t, example)))
			}
		})
	}
}

func TestToolProfilesDiscoverAndCallTheSameSubset(t *testing.T) {
	e := echo.New()
	service, err := NewMCPService(&profile.Profile{}, e)
	require.NoError(t, err)
	service.RegisterRoutes(e)
	for _, toolProfile := range []string{"all", "notes", "personal"} {
		t.Run(toolProfile, func(t *testing.T) {
			path := "/mcp?profile=" + toolProfile
			response := postMCPAt(t, e, path, map[string]any{"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
			names := map[string]bool{}
			for _, raw := range requireValueAs[[]any](t, requireValueAs[map[string]any](t, response["result"])["tools"]) {
				tool := requireValueAs[map[string]any](t, raw)
				names[requireValueAs[string](t, tool["name"])] = true
				require.NotEmpty(t, requireValueAs[map[string]any](t, tool["_meta"])["category"])
			}
			require.True(t, names[activitySummaryToolName])
			require.True(t, names["auth_get_current_user"])
			if toolProfile == "all" {
				require.Len(t, names, 56)
				require.True(t, names["shortcut_list_shortcuts"])
				return
			}
			require.NotContains(t, names, "shortcut_list_shortcuts")
			require.NotContains(t, names, "instance_get_instance_stats")
			if toolProfile == "notes" {
				require.True(t, names["memo_view_list_memo_views"])
				require.NotContains(t, names, "finance_list_finance_wallets")
				response = postMCPAt(t, e, path, map[string]any{
					"jsonrpc": "2.0", "id": 2, "method": "tools/call",
					"params": map[string]any{"name": "finance_list_finance_wallets", "arguments": map[string]any{}},
				})
				require.NotNil(t, response["error"], "hidden tools must not be callable through the focused profile")
			} else {
				require.True(t, names["reminder_get_reminder_stats"])
				require.True(t, names["finance_get_finance_summary"])
				require.NotContains(t, names, "attachment_create_attachment")
			}
		})
	}
}

func TestInvalidToolProfilesFailClearly(t *testing.T) {
	e := echo.New()
	service, err := NewMCPService(nil, e)
	require.NoError(t, err)
	service.RegisterRoutes(e)
	for _, query := range []string{"profile=unknown", "profile=", "profile=notes&profile=personal"} {
		_, err := requestedToolProfile(mustParseQuery(t, query))
		require.Error(t, err)
		recorder := httptest.NewRecorder()
		e.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/mcp?"+query, nil))
		require.Equal(t, http.StatusBadRequest, recorder.Code)
	}
}

func mustParseQuery(t *testing.T, query string) url.Values {
	t.Helper()
	values, err := url.ParseQuery(query)
	require.NoError(t, err)
	return values
}
