import { Editor } from "@usememos/editor";
import { afterEach, describe, expect, it } from "vitest";
import { createFormattingController } from "@/components/MemoEditor/Editor/formatting";

const editors: Editor[] = [];
function setup(content: string, from = 0, to = from) {
  const element = document.body.appendChild(document.createElement("div"));
  const editor = new Editor({ element, content, markdown: { breaks: true, setext: false } });
  editors.push(editor);
  editor.setSelection({ anchor: { block: 0, offset: from }, focus: { block: 0, offset: to } });
  return { editor, f: createFormattingController(() => editor) };
}
afterEach(() => editors.splice(0).forEach((editor) => editor.destroy()));

describe("formatting controller", () => {
  it("bolds selected text and reports the active format", () => {
    const { editor, f } = setup("hello world", 0, 5);
    f.run("bold");
    expect(editor.getMarkdown()).toBe("**hello** world");
    expect(f.getActiveFormats().bold).toBe(true);
    f.run("bold");
    expect(editor.getMarkdown()).toBe("hello world");
  });
  it("sets heading levels and returns to paragraph", () => {
    const { editor, f } = setup("Title");
    f.run("heading2");
    expect(editor.getMarkdown()).toBe("## Title");
    expect(f.getActiveFormats().headingLevel).toBe(2);
    f.run("paragraph");
    expect(editor.getMarkdown()).toBe("Title");
  });
  it.each(["bulletList", "orderedList", "taskList"] as const)("toggles %s without losing text", (command) => {
    const { editor, f } = setup("item");
    f.run(command);
    expect(f.getActiveFormats()[command]).toBe(true);
    expect(editor.getMarkdown()).toContain("item");
    f.run(command);
    expect(editor.getMarkdown()).toBe("item");
  });
  it.each(["italic", "strikethrough", "code", "codeBlock"] as const)("toggles %s", (command) => {
    const { editor, f } = setup("text", 0, 4);
    f.run(command);
    expect(f.getActiveFormats()[command]).toBe(true);
    f.run(command);
    expect(editor.getMarkdown()).toBe("text");
  });
});
