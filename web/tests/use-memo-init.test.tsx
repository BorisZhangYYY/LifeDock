import { create } from "@bufbuild/protobuf";
import { render, waitFor } from "@testing-library/react";
import type { RefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMemoInit } from "@/components/MemoEditor/hooks/useMemoInit";
import { cacheService } from "@/components/MemoEditor/services/cacheService";
import { EditorProvider, useEditorContext } from "@/components/MemoEditor/state";
import type { EditorController } from "@/components/MemoEditor/types/editorController";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";

const editorRef = { current: null } as RefObject<EditorController | null>;
let getEditorState: ReturnType<typeof useEditorContext>["getState"];

function Probe({ allowedVisibilities }: { allowedVisibilities?: string[] }) {
  getEditorState = useEditorContext().getState;
  useMemoInit({
    editorRef,
    username: "users/steven",
    cacheKey: "restored-draft",
    allowedVisibilities,
    defaultVisibility: Visibility.PRIVATE,
  });
  return null;
}

describe("useMemoInit", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key)),
    });
    cacheService.clearAll();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("restores uploaded attachment bindings with a new memo draft", async () => {
    const attachment = create(AttachmentSchema, {
      name: "attachments/image-one",
      filename: "image.png",
      type: "image/png",
    });
    cacheService.saveNow(cacheService.key("users/steven", "restored-draft"), "![image](/file/attachments/image-one)", [attachment]);

    render(
      <EditorProvider>
        <Probe />
      </EditorProvider>,
    );

    await waitFor(() => {
      expect(getEditorState().content).toBe("![image](/file/attachments/image-one)");
      expect(getEditorState().metadata.attachments).toEqual([attachment]);
    });
  });

  it("restores Space and audience together with mood and reminder metadata", async () => {
    cacheService.saveNow(cacheService.key("users/steven", "restored-draft"), "Draft", [], {
      space: "spaces/work",
      visibility: Visibility.SPACE,
      moodLevel: 6,
      reminderNames: ["users/steven/reminders/one"],
    });
    render(
      <EditorProvider>
        <Probe />
      </EditorProvider>,
    );
    await waitFor(() =>
      expect(getEditorState().metadata).toMatchObject({ space: "spaces/work", visibility: Visibility.SPACE, moodLevel: 6 }),
    );
    expect(cacheService.loadDraft(cacheService.key("users/steven", "restored-draft")).reminderNames).toEqual([
      "users/steven/reminders/one",
    ]);
  });

  it("does not restore public visibility disabled by the instance", async () => {
    cacheService.saveNow(cacheService.key("users/steven", "restored-draft"), "Draft", [], { visibility: Visibility.PUBLIC });
    render(
      <EditorProvider>
        <Probe allowedVisibilities={["PRIVATE"]} />
      </EditorProvider>,
    );
    await waitFor(() => expect(getEditorState().metadata.visibility).toBe(Visibility.PRIVATE));
  });
});
