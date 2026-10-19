package mcp

import (
	"context"
	"encoding/json"
	"maps"
	"net/http"

	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"
	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/pkg/errors"
	"gopkg.in/yaml.v3"

	"github.com/usememos/memos/internal/profile"
	memosproto "github.com/usememos/memos/proto"
	apiv1 "github.com/usememos/memos/server/router/api/v1"
)

// maxMCPRequestBytes caps the /mcp request body. It tracks the API limit because
// every tool call is forwarded in-process through the API routes.
const maxMCPRequestBytes int64 = apiv1.MaxAPIRequestBytes

// MCPService serves the OpenAPI-driven MCP endpoint.
type MCPService struct {
	profile *profile.Profile

	operationsByTool map[string]*registeredOperation
	handler          http.Handler
}

// NewMCPService creates an MCP service backed by the in-process API routes.
func NewMCPService(profile *profile.Profile, echoServer *echo.Echo) (*MCPService, error) {
	spec, err := loadMCPServiceOpenAPISpec()
	if err != nil {
		return nil, err
	}
	registry, err := buildOperationRegistry(spec)
	if err != nil {
		return nil, err
	}
	tools, operationsByTool, err := buildCuratedTools(registry)
	if err != nil {
		return nil, err
	}

	version := "dev"
	if profile != nil && profile.Version != "" {
		version = profile.Version
	}
	adapter := newAPIAdapter(echoServer)
	handlers := make(map[string]sdkmcp.ToolHandler, len(tools)+1)
	for _, tool := range tools {
		operation := operationsByTool[tool.Name]
		handler, err := newMCPToolHandler(adapter, operation)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to compile input schema for %s", tool.Name)
		}
		handlers[tool.Name] = handler
	}
	summaryTool, summaryHandler, err := newActivitySummaryTool(adapter, registry["UserService_GetUserStats"])
	if err != nil {
		return nil, err
	}
	tools = append(tools, summaryTool)
	handlers[summaryTool.Name] = summaryHandler
	servers := map[string]*sdkmcp.Server{}
	for _, toolProfile := range []string{"all", "notes", "personal"} {
		server := sdkmcp.NewServer(&sdkmcp.Implementation{Name: "memos", Version: version}, nil)
		for _, tool := range tools {
			if toolInProfile(tool, toolProfile) {
				server.AddTool(tool, handlers[tool.Name])
			}
		}
		servers[toolProfile] = server
	}

	streamableHandler := sdkmcp.NewStreamableHTTPHandler(func(request *http.Request) *sdkmcp.Server {
		toolProfile, _ := requestedToolProfile(request.URL.Query()) // Validated by RegisterRoutes.
		return servers[toolProfile]
	}, &sdkmcp.StreamableHTTPOptions{
		Stateless:    true,
		JSONResponse: true,
		// memos is typically served behind a reverse proxy with the app bound to a
		// loopback address while the public Host header is a real domain. The SDK's
		// DNS-rebinding guard treats that shape as an attack and rejects every
		// request with 403 ("invalid Host header"). Disable it and rely on memos'
		// own Origin/Host allowlist (see RegisterRoutes -> isAllowedMCPOrigin) for
		// CSRF / DNS-rebinding protection instead.
		DisableLocalhostProtection: true,
	})
	return &MCPService{
		profile:          profile,
		operationsByTool: operationsByTool,
		handler:          streamableHandler,
	}, nil
}

func loadMCPServiceOpenAPISpec() (*openAPISpec, error) {
	spec := &openAPISpec{}
	if err := yaml.Unmarshal(memosproto.OpenAPIYAML(), spec); err != nil {
		return nil, errors.Wrap(err, "failed to parse embedded OpenAPI spec")
	}
	if spec.Paths == nil {
		return nil, errors.New("embedded OpenAPI spec has no paths")
	}
	return spec, nil
}

func newMCPToolHandler(adapter *apiAdapter, operation *registeredOperation) (sdkmcp.ToolHandler, error) {
	validator, err := compileToolArgumentValidator(operation.InputSchema)
	if err != nil {
		return nil, err
	}
	return func(ctx context.Context, request *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
		arguments := map[string]any{}
		if request.Params != nil && len(request.Params.Arguments) > 0 {
			if err := json.Unmarshal(request.Params.Arguments, &arguments); err != nil {
				return newToolErrorResult(errors.Wrap(err, "failed to decode MCP tool arguments").Error()), nil
			}
		}
		if err := validator.validate(arguments); err != nil {
			return newToolErrorResult(err.Error()), nil
		}
		if operation.OperationID == "ReminderService_ListReminderOccurrences" {
			startDate := valueToString(arguments["startDate"])
			endDate := valueToString(arguments["endDate"])
			if _, _, err := parseCalendarDateRange(startDate, endDate); err != nil {
				return newToolErrorResult(err.Error()), nil
			}
		}

		authorization := ""
		if request.Extra != nil {
			authorization = request.Extra.Header.Get("Authorization")
		}
		if operation.ImplicitCurrentUser {
			currentUserName, err := adapter.resolveCurrentUserName(ctx, authorization)
			if err != nil {
				return newToolErrorResult(errors.Wrap(err, "failed to resolve current user").Error()), nil
			}
			arguments = maps.Clone(arguments)
			arguments["user"] = currentUserName
		}
		return adapter.execute(ctx, operation.Operation, arguments, authorization)
	}, nil
}

// RegisterRoutes registers the streamable HTTP MCP endpoint.
func (s *MCPService) RegisterRoutes(echoServer *echo.Echo) {
	echoServer.Any("/mcp", func(c *echo.Context) error {
		request := c.Request()
		if !isAllowedMCPOrigin(request.Host, request.Header.Get("Origin"), s.profile) {
			return c.NoContent(http.StatusForbidden)
		}
		if _, err := requestedToolProfile(request.URL.Query()); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
		}
		s.handler.ServeHTTP(c.Response(), request)
		return nil
	}, middleware.BodyLimit(maxMCPRequestBytes))
}
