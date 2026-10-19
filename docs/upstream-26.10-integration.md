# Selected 26.10 capabilities in LifeDock

This integrates the four writing and browsing capabilities reviewed from
[Memos 26.10-rc.1](https://usememos.com/changelog/26-10-rc-1), while keeping
LifeDock's v1 APIs, mood, reminders, and finance features.

## Editor suggestions

New drafts offer up to three suggestions after text is entered. Explicit tag
selections take priority over CEL search and Saved Views. Suggestions can insert
a tag, format a checklist, or select an unambiguous audience. They require an
explicit click and disappear when the draft fulfills the condition.

The Boolean expression reader and candidate providers are adapted from the
tagged upstream implementation. Unsupported expressions contribute no inferred
conditions. Excluded tags, conflicting audiences, existing Markdown tags and
checklists, Space placement, and instance visibility policy are respected.
Suggestions appear in the home editor, calendar composer, and global composer.

## Audio attachments

When transcription is configured, existing audio attachments in the editor have
a Transcribe button. The original file and draft content stay intact; the result
is inserted into the draft for review. A closing editor cancels the request,
duplicate requests are prevented, and saving waits for transcription. Audio is
limited to the same 25 MiB bound as the existing server API.

This uses the configured provider and existing AI API. The local acceptance
environment uses an explicitly named fixture provider returning fixed text; that
fixture tests the interaction and transport, not speech recognition accuracy.

## Creator and Space browsing

The creator selector offers My memos, All creators, and creators with readable
records. The selected creator is carried in `?creator=<username>` (`all` selects
all creators) when switching Timeline, Calendar, Map, and Attachments. The
existing account-specific Space selection continues across those pages.

Shared attachment listing uses the same memo access policy before pagination.
The `creator` attachment filter refers to a linked memo's author, or an unlinked
file's uploader. Unlinked files remain private to their uploader. All three SQL
drivers support this filter without a schema migration. The unused-file cleanup
entry is offered only for the current user's unscoped collection.

This does not adopt upstream's API path migration or public visitor navigation.
Existing instance access and authentication requirements remain in effect.

## Audience and placement

The editor's audience menu now includes Space placement for owned top-level
memos. Placement is saved together with visibility and content in one UpdateMemo
request. Moving a SPACE-visible memo explicitly includes its audience; removing
the Space changes that audience to Private. Replies cannot change their Space
independently. Drafts preserve placement, visibility, mood, uploaded attachments,
and reminder associations.

## Verification

```sh
(cd web && pnpm lint && pnpm test && pnpm build)
SKIP_MINIO_TESTS=1 go test -v ./store/...
SKIP_MINIO_TESTS=1 go test -v -race ./internal/...
go test -v -race ./server/...
```

The frontend suite includes real-editor suggestion application, attachment
transcription cancellation and transport, Space/audience update masks, draft
restoration, and creator navigation. Backend coverage verifies shared attachment
visibility, private/unlinked exclusions, combined Space/creator filters, and all
three drivers' memo-author versus uploader semantics. The earlier MCP workflow
suite remains part of the server checks.

Local external-service limitations observed during verification:

- The pinned MinIO image cannot be pulled from Docker Hub. Container-backed
  MinIO checks are skipped with `SKIP_MINIO_TESTS=1`; MySQL and PostgreSQL checks
  still run against their real containers.
- The pre-existing webhook lifecycle test resolves example.com during URL
  validation. Local DNS resolution failed. A temporary Go test overlay substitutes
  a fixed public IP in that test only, allowing its original assertions and the
  remaining server suite to run without changing repository sources.

Release preparation also corrects a pre-existing epoch-variable naming issue in
`store/db/moodhistory/moodhistory.go`; full-repository Go lint passes with the
configured Go 1.27 and golangci-lint v2.13.1 toolchain.

Browser acceptance also covered suggestions, audio insertion and pending-save
blocking, shared creator/Space navigation, and saving placement/audience/content
together while preserving mood and reminder associations. It caught and fixed a
calendar month redirect that dropped the query string, plus toolbar overflow with
long Space titles on a 390px screen. The final frontend suite has 193 passing
files and 1,440 passing tests.
