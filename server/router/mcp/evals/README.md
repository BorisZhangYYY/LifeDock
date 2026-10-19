# MCP Evaluations

Task-level evaluations for the memos MCP server. Where the `*_test.go` files
verify the server *plumbing* (schema resolution, tool naming, annotations),
these check the thing that actually matters for an MCP server: **can an LLM
accomplish realistic tasks by composing the tools?** They are the regression
net for tool descriptions and discoverability — e.g. a bad `filter` description
leaves the unit tests green but makes question 3/5/9 unanswerable.

`memos_eval.xml` holds 10 question/answer pairs in the format used by the
mcp-builder skill. Each question is independent, read-only, requires multiple
tool calls, and has a single string-comparable answer.

`tool_selection_eval.xml` is a smaller definition-level suite. It asks the
model to return the exact tool name(s), without calling anything, for similar
configuration and content-editing requests. It specifically guards the
difference between a memo's `moodLevel`, the seven-level Emoji/color display
configuration, memo reactions, and finance category Emoji. Its answers do not
depend on seeded data. It also covers Chinese requests for reminder history,
retained statistics, compact daily summaries, Saved Views, and finance totals.

## Automated checks and model evaluation

The normal backend server test job runs
`server/test/mcp_workflows_test.go` against a fresh SQLite database and the real
HTTP MCP endpoint. It verifies recurring-reminder advancement, retained history
after list deletion, ledger corrections/deletion, deleted-memo mood summaries,
anonymous refusal, and cross-user isolation. These are deterministic service
checks, not evidence that a language model can complete the tasks.

`run.py` provides a repeatable model-evaluation and scoring entry point using
only the Python standard library:

```bash
# Supply an executable that connects to your chosen model.
# MEMOS_MCP_TOKEN is read from the environment and is never printed by the harness.
python3 -B server/router/mcp/evals/run.py \
  --suite server/router/mcp/evals/tool_selection_eval.xml \
  --mcp-url http://localhost:8099/mcp \
  --runner '/absolute/path/to/your-model-runner' \
  --report /tmp/mcp-tool-selection-report.json

# Score saved model answers without connecting to an instance or model.
python3 -B server/router/mcp/evals/run.py \
  --suite server/router/mcp/evals/tool_selection_eval.xml \
  --answers /tmp/mcp-answers.json

# Harness self-tests, also run by backend CI.
python3 -B -m unittest discover -s server/router/mcp/evals -p '*_test.py'
```

The runner is invoked directly, without a shell, once per question. It reads a
JSON object from stdin containing `question`, `mode`, `instructions`, `tools`,
and `mcp` (`url` and request `headers`). Expected answers are never sent to it.
It writes only its final answer to stdout. In `selection` mode it must not call
tools; in `tasks` mode it may compose read-only MCP calls against the supplied
instance. Use `memos_eval.xml` for seeded task questions. Each runner invocation
is independent; do not carry answer state between questions.

The answers file is a JSON array of strings in question order. Selection scoring
strips client-added `mcp__<server>__` prefixes and normalizes comma spacing;
task scoring only trims outer whitespace. Reports include each expected and
actual answer. Exit codes are 0 for all correct, 1 for any incorrect answer,
and 2 for configuration, transport, or runner failures. `--timeout` defaults to
60 seconds per question. Changing descriptions should be followed by a real
model run; harness self-tests alone do not validate model behavior.

## Why a fresh seeded instance (not the public demo)

Answers are pinned to the deterministic seed in
[`store/seed/sqlite/01__dump.sql`](../../../../store/seed/sqlite/01__dump.sql)
(10 memos — 7 top-level + 3 comments — 2 users, 12 reactions, no attachments,
no memo views).

The public demo (`demo.usememos.com`) signs everyone into the **same shared
`demo` account**, so visitors continually add/edit/delete memos and reactions.
Its data has already diverged from the seed — do **not** evaluate against it.

The seed uses **relative** timestamps (`strftime('now','-N days')`), so the
questions avoid absolute dates and rely only on relative ordering, counts, and
content, all of which are stable across re-seeds.

## Running an evaluation

1. Launch a throwaway demo-mode instance (SQLite, auto-seeded) on a free port:

   ```bash
   go run ./cmd/memos --demo --driver sqlite \
     --port 8099 --data "$(mktemp -d)" \
     --instance-url http://localhost:8099
   ```

2. The MCP endpoint is `http://localhost:8099/mcp`. Authenticate with the seed's
   demo personal access token:

   ```
   Authorization: Bearer memos_pat_demo
   ```

3. Point an MCP client / eval harness at that endpoint and have the model answer
   each `<question>`, then string-compare against each `<answer>`.

   For `tool_selection_eval.xml`, expose the same MCP tool definitions but
   instruct the model not to execute tools. Exact-match the comma-separated
   tool names in the answer. Some clients namespace names at presentation time;
   for example Claude Code returns `mcp__memos__memo_set_memo_mood`. Strip the
   client-added `mcp__<server>__` prefix before comparing with the server's
   declared tool name.

   Quick manual check of a single tool call:

   ```bash
   curl -s -X POST http://localhost:8099/mcp \
     -H 'Content-Type: application/json' \
     -H 'Accept: application/json, text/event-stream' \
     -H 'Authorization: Bearer memos_pat_demo' \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"memo_list_memos","arguments":{"filter":"pinned == true"}}}'
   ```

## Notes for whoever extends this

- The CEL `tag` field does **not** support `==`; filter tags with
  `"work" in tags` (or `tags.exists(t, t == "work")`), not `tag == "work"`.
- `memo_list_memos` returns only top-level memos; comments are reached via
  `memo_list_memo_comments`.
- The seed defines no memo views and no attachments, so `memo_view_list_memo_views`
  and the attachment tools return empty sets against a fresh seed. Add seed rows
  before writing questions that depend on them.
