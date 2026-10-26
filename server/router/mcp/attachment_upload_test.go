package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/profile"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/auth"
	apiv1 "github.com/usememos/memos/server/router/api/v1"
	"github.com/usememos/memos/store"
	teststore "github.com/usememos/memos/store/test"
)

// TestAttachmentUploadWithPAT exercises issue #12 against real API routes and storage.
func TestAttachmentUploadWithPAT(t *testing.T) {
	ctx := context.Background()
	st := teststore.NewTestingStore(ctx, t)
	t.Cleanup(func() { st.Close() })
	_, err := st.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_ACCESS,
		Value: &storepb.InstanceSetting_AccessSetting{AccessSetting: &storepb.InstanceAccessSetting{
			AccessMode: storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PRIVATE,
		}},
	})
	require.NoError(t, err)
	user, err := st.CreateUser(ctx, &store.User{Username: "uploader", Role: store.RoleUser})
	require.NoError(t, err)
	p := &profile.Profile{Data: t.TempDir()}
	api := apiv1.NewAPIV1Service("test-secret", p, st)
	t.Cleanup(api.CloseUploads)
	userCtx := context.WithValue(ctx, auth.UserIDContextKey, user.ID)
	pat, err := api.CreatePersonalAccessToken(userCtx, &v1pb.CreatePersonalAccessTokenRequest{
		Parent: "users/uploader", Description: "attachment regression test",
	})
	require.NoError(t, err)
	e := echo.New()
	require.NoError(t, api.RegisterGateway(ctx, e))
	service, err := NewMCPService(p, e)
	require.NoError(t, err)
	service.RegisterRoutes(e)
	initializeMCP(t, e)

	request := func(method, path, contentType string, body []byte, token string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, bytes.NewReader(body))
		req.Header.Set("Content-Type", contentType)
		req.Header.Set("Accept", "application/json, text/event-stream")
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		return rec
	}
	jsonBody := []byte(`{"filename":"note.txt","type":"text/plain","content":"YWJj"}`)
	mcpBody := []byte(`{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"attachment_create_attachment","arguments":{"body":{"filename":"note.txt","type":"text/plain","content":"YWJj"}}}}`)
	var multipartBody bytes.Buffer
	writer := multipart.NewWriter(&multipartBody)
	file, err := writer.CreateFormFile("file", "note.txt")
	require.NoError(t, err)
	_, err = file.Write([]byte("abc"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	checkStored := func(name string) {
		t.Helper()
		uid := strings.TrimPrefix(name, "attachments/")
		attachment, err := st.GetAttachment(ctx, &store.FindAttachment{UID: &uid})
		require.NoError(t, err)
		require.NotNil(t, attachment)
		require.Equal(t, user.ID, attachment.CreatorID)
		require.EqualValues(t, 3, attachment.Size)
		content, err := os.ReadFile(attachment.Reference)
		require.NoError(t, err)
		require.Equal(t, "abc", string(content))
	}

	t.Run("same PAT reads memos and uploads JSON", func(t *testing.T) {
		rec := request(http.MethodGet, "/api/v1/memos", "application/json", nil, pat.Token)
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		rec = request(http.MethodPost, "/api/v1/attachments", "application/json", jsonBody, pat.Token)
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		var attachment struct{ Name string }
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &attachment))
		require.True(t, strings.HasPrefix(attachment.Name, "attachments/"))
		checkStored(attachment.Name)
	})

	t.Run("MCP forwards the PAT to the real upload route", func(t *testing.T) {
		rec := request(http.MethodPost, "/mcp", "application/json", mcpBody, pat.Token)
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		var response struct {
			Result struct {
				IsError           bool
				StructuredContent struct{ Name string }
			}
		}
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &response))
		require.False(t, response.Result.IsError, rec.Body.String())
		require.True(t, strings.HasPrefix(response.Result.StructuredContent.Name, "attachments/"), rec.Body.String())
		checkStored(response.Result.StructuredContent.Name)
	})

	t.Run("multipart is a format error with a valid PAT", func(t *testing.T) {
		rec := request(http.MethodPost, "/api/v1/attachments", writer.FormDataContentType(), multipartBody.Bytes(), pat.Token)
		require.Equal(t, http.StatusBadRequest, rec.Code, rec.Body.String())
	})

	checkRejected := func(t *testing.T, token string) {
		t.Helper()
		for _, body := range []struct {
			contentType string
			data        []byte
		}{{"application/json", jsonBody}, {writer.FormDataContentType(), multipartBody.Bytes()}} {
			rec := request(http.MethodPost, "/api/v1/attachments", body.contentType, body.data, token)
			require.Equal(t, http.StatusUnauthorized, rec.Code, rec.Body.String())
		}
		rec := request(http.MethodPost, "/mcp", "application/json", mcpBody, token)
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		require.Contains(t, rec.Body.String(), `"isError":true`)
		require.Contains(t, rec.Body.String(), "authentication required")
	}
	t.Run("missing PAT", func(t *testing.T) { checkRejected(t, "") })
	t.Run("unknown PAT", func(t *testing.T) { checkRejected(t, auth.GeneratePersonalAccessToken()) })
	t.Run("revoked PAT", func(t *testing.T) {
		_, err := api.DeletePersonalAccessToken(userCtx, &v1pb.DeletePersonalAccessTokenRequest{Name: pat.PersonalAccessToken.Name})
		require.NoError(t, err)
		checkRejected(t, pat.Token)
	})
	attachments, err := st.ListAttachments(ctx, &store.FindAttachment{})
	require.NoError(t, err)
	require.Len(t, attachments, 2, "rejected requests must not store attachments")
}
