# MemoEditor

LifeDock's composer uses `@usememos/editor` **26.10.27**, pinned exactly because upstream CalVer releases may change APIs. The editing engine owns blocks, selection, history, input methods, Markdown shortcuts, task checkboxes and slash commands. LifeDock owns the surrounding draft and metadata workflows.

## Layers

- `Editor/`: the upstream engine behind `types/editorController.ts`. It mounts in a layout effect, so the Home composer paints with the page. `contentIsExternal` distinguishes restored/server content from editor echoes; external content waits until an active IME composition ends.
- `state/`: the existing external store holds Markdown and metadata. Content changes subscribe independently of attachment, mood, Space and toolbar state.
- `hooks/` and `services/`: draft caching, save validation, uploads, transcription, timestamps, location and reminder associations. These remain outside the editor implementation.
- `Toolbar/` and `components/`: LifeDock's audience, placement, mood, reminder, recording and focus controls. The existing formatting toolbar maps to upstream commands through `Editor/formatting.ts`; the upstream selection toolbar and slash menu are also available.

## Rich and Markdown modes

The Add menu offers **Markdown mode** in every composer, including the global composer. It switches the live engine between `rich` and `source`, without serializing/replacing the document or clearing undo history. The preference is stored per device as `memos-editor-mode`. A newly opened composer restores it; an invalid stored value falls back to rich mode.

Rich mode renders editable headings, marks, tables, image blocks and task checkboxes. Source mode shows the Markdown text with syntax highlighting and plain tag text. The parser uses `breaks: true` and `setext: false`, matching LifeDock's note dialect.

## Controller and attachments

Everything outside `Editor/` uses `EditorController`; no caller reaches into the engine DOM. The controller exposes Markdown, tags and checklist queries, focus, selection restoration, formatting and upload anchors. `getCursor()` returns the engine's JSON-safe block selection; the cache stores it without changing draft content. Numeric cursors remain accepted for existing callers.

File paste adds files to the attachment list. Image drops carry an upstream document position; the image upload hook shows a transient widget after that block. Widgets track edits, show progress and retry/keep actions, and never enter the saved Markdown or undo history. Resolution inserts managed attachment Markdown without replacing highlighted text. Late callbacks after the engine is destroyed do nothing.

`lib/memo-markdown.ts` supplies the shared editor dialect, theme, URL policy and translated labels. Managed images resolve through the draft attachment list. Raw HTML previews use `lib/sanitized-html.ts`, the existing iframe allowlist and HTTPS source normalizer, including Bilibili's no-autoplay default.

## Business workflows and rendering

The existing draft cache format, attachments, reminder associations, mood, Space/audience, timestamps, voice transcription and private-content verification remain in their current workflows. No API path or auth/token behavior changes are required by the engine swap.

Published memo rendering continues through the existing `MemoContent` pipeline. This preserves its task actions, privacy handling, footnotes, link cards, diagrams and share rendering while replacing the input engine. Its Lezer grammar helper is still used by the read-only renderer; the CodeMirror editor packages and their old integration modules have been removed.

## Verification

From `web/`:

```sh
pnpm lint
pnpm test
pnpm build
```

The suite tests native engine round trips, rich/source switching and undo, task detection, tag completion, IME deferral, upload widgets, file paste, formatting, save shortcuts, draft metadata and the existing transcription, Space, reminder and privacy workflows. Tests that depended on CodeMirror internals have been replaced by tests of the new engine's behavior.
