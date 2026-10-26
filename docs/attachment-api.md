# Uploading attachments with an access token

The current LifeDock API accepts the same Personal Access Token (PAT) for
`GET /api/v1/memos`, `POST /api/v1/attachments`, and MCP attachment uploads.
Send it in `Authorization: Bearer <token>`.

## REST API

`POST /api/v1/attachments` expects `application/json`. Its body is the attachment
itself, with `content` encoded as base64 without a `data:` prefix. It does not
accept `multipart/form-data` or `curl -F` uploads.

For example, after setting `LIFEDOCK_URL` to your instance URL and
`LIFEDOCK_TOKEN` to a PAT created in Settings → Access Tokens:

```bash
curl --fail-with-body "${LIFEDOCK_URL}/api/v1/attachments" \
  -H "Authorization: Bearer ${LIFEDOCK_TOKEN}" \
  -H 'Content-Type: application/json' \
  --data '{"filename":"note.txt","type":"text/plain","content":"YWJj"}'
```

This uploads a three-byte file containing `abc`. To attach it directly to an
existing memo, add `"memo":"memos/<memo-id>"` to the JSON body. The response
contains the attachment's `name`, filename, size, and type.

For larger files, use `POST /api/v1/attachments:upload`, the bounded, resumable
upload API defined in `proto/api/v1/attachment_service.proto`.

## MCP

Configure the MCP client to send the same Bearer header to `/mcp` (or
`/mcp?profile=notes`), then call `attachment_create_attachment` with:

```json
{
  "body": {
    "filename": "note.txt",
    "type": "text/plain",
    "content": "YWJj"
  }
}
```

Add `memo` inside `body` to link the upload to an existing memo. See the
[MCP guide](../server/router/mcp/README.md) for the illustrated memo workflow.

## Troubleshooting issue #12

[Issue #12](https://github.com/BorisZhangYYY/LifeDock/issues/12) reported a 401
response from a v0.24.2 deployment using a multipart request. Regression coverage
against the current server confirms:

- The same valid PAT reads memos and uploads JSON attachments through REST and MCP.
- A multipart upload with a valid PAT returns **400**, because the body format
  is unsupported.
- Missing, unknown, or revoked PATs are rejected; rejected requests create no
  attachment. MCP reports these failures as tool errors.

If a deployed instance still returns **401** for the JSON example above, check
the running LifeDock version, confirm the PAT belongs to that instance and is
active, and verify the reverse proxy preserves the `Authorization` header on
POST requests. The old deployment's reported 401 cannot be attributed to the
multipart format alone.

The regression test uses a temporary database, creates its own PAT, exercises
the real REST and MCP routes, and checks the saved file bytes and owner:

```bash
go test -v -race ./server/router/mcp -run '^TestAttachmentUploadWithPAT$'
```
