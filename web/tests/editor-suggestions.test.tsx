import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { EditorContent } from "@/components/MemoEditor/components/EditorContent";
import { EditorSuggestions } from "@/components/MemoEditor/components/EditorSuggestions";
import { createInitialState, EditorProvider, useEditorSelector } from "@/components/MemoEditor/state";
import type { EditorController } from "@/components/MemoEditor/types/editorController";
import { getMemoSuggestions } from "@/lib/memo-suggestions";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";

vi.mock("@/hooks/useUserQueries", () => ({ useTagCounts: () => ({ data: {} }) }));
vi.mock("@/contexts/InstanceContext", () => ({ useInstance: () => ({ memoRelatedSetting: { allowedVisibilities: ["PRIVATE"] } }) }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

const VisibilityProbe = () => <output data-testid="visibility">{useEditorSelector((state) => state.metadata.visibility)}</output>;

function renderEditor(content: string, filter = '"验收" in tags && has_task_list && visibility == "PROTECTED"') {
  const state = createInitialState();
  state.content = content;
  const ref = createRef<EditorController>();
  render(
    <EditorProvider initialEditorState={state}>
      <EditorContent ref={ref} onSubmit={vi.fn()} onFiles={vi.fn()} />
      <EditorSuggestions suggestions={getMemoSuggestions([], filter)} controllerRef={ref} />
      <VisibilityProbe />
    </EditorProvider>,
  );
  return ref;
}

describe("editor context suggestions", () => {
  it("applies tags, checklists, and visibility explicitly, preserving text and hiding fulfilled suggestions", () => {
    const ref = renderEditor("Review the release");
    act(() => ref.current?.setCursor(100));
    fireEvent.click(screen.getByRole("button", { name: "common.add #验收" }));
    expect(ref.current?.getMarkdown()).toContain("Review the release #验收");
    expect(screen.queryByRole("button", { name: "common.add #验收" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "editor.format.task-list" }));
    expect(ref.current?.getMarkdown()).toMatch(/- \[ \] Review the release/);
    expect(screen.queryByRole("button", { name: "editor.format.task-list" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "memo.visibility.protected" }));
    expect(screen.getByTestId("visibility")).toHaveTextContent(String(Visibility.PROTECTED));
    expect(screen.queryByRole("group", { name: "editor.suggestions" })).not.toBeInTheDocument();
  });
  it("does not infer a fulfilled tag from code, and hides policy-disabled audiences", () => {
    renderEditor("`#验收` remains code", '"验收" in tags && visibility == "PUBLIC"');
    expect(screen.getByRole("button", { name: "common.add #验收" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "memo.visibility.public" })).not.toBeInTheDocument();
  });
  it("keeps empty drafts free of suggestions", () => {
    renderEditor("");
    expect(screen.queryByRole("group", { name: "editor.suggestions" })).not.toBeInTheDocument();
  });
});
