import { Editor } from "@usememos/editor";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildEditorExtensions } from "@/components/MemoEditor/Editor/extensions";

const editors: Editor[] = [];
afterEach(() => editors.splice(0).forEach((editor) => editor.destroy()));
describe("MemoEditor upstream extensions", () => {
  it.each([
    ["paste", "clipboardData"],
    ["drop", "dataTransfer"],
  ] as const)("handles files on %s without inserting their text", (type, property) => {
    const onFiles = vi.fn();
    const editor = new Editor({
      element: document.body.appendChild(document.createElement("div")),
      content: "memo",
      extensions: buildEditorExtensions({ getTags: () => [], onFiles, emojiLabel: "Emoji" }),
    });
    editors.push(editor);
    const file = new File(["must not become content"], "attachment.txt", { type: "text/plain" });
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, property, {
      value: { files: [file], items: [{ kind: "file", getAsFile: () => file }], types: ["Files"], getData: () => "" },
    });
    editor.root.dispatchEvent(event);
    expect(onFiles).toHaveBeenCalledWith([file], type === "paste" ? { source: "paste" } : { source: "drop", position: null });
    expect(event.defaultPrevented).toBe(true);
    expect(editor.getMarkdown()).toBe("memo");
  });
});
