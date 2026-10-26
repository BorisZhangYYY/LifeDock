import { Editor } from "@usememos/editor";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildEditorExtensions } from "@/components/MemoEditor/Editor/extensions";

const editors: Editor[] = [];
const makeEditor = (content: string, options: Partial<ConstructorParameters<typeof Editor>[0]> = {}) => {
  const editor = new Editor({
    element: document.body.appendChild(document.createElement("div")),
    content,
    extensions: buildEditorExtensions({ getTags: () => [], onFiles: vi.fn(), emojiLabel: "Emoji" }),
    ...options,
  });
  editors.push(editor);
  return editor;
};
afterEach(() => editors.splice(0).forEach((editor) => editor.destroy()));

describe("upstream editor keyboard integration", () => {
  it.each([{ metaKey: true }, { ctrlKey: true }])("submits with the save shortcut %j without changing the document", (modifier) => {
    const onSubmit = vi.fn();
    const editor = makeEditor("hello", { onSubmit });
    editor.focus();
    editor.root.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ...modifier, bubbles: true, cancelable: true }));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(editor.getMarkdown()).toBe("hello");
  });
  it("keeps undo history while switching source mode", () => {
    const editor = makeEditor("alpha");
    editor.commands.insertText("X");
    const edited = editor.getMarkdown();
    editor.setOptions({ mode: "source" });
    expect(editor.getMarkdown()).toBe(edited);
    editor.setOptions({ mode: "rich" });
    editor.commands.undo();
    expect(editor.getMarkdown()).toBe("alpha");
  });
  it("continues a checklist in source mode", () => {
    const editor = makeEditor("- [ ] first", { mode: "source" });
    editor.setSelection({ anchor: { block: 0, offset: 11 }, focus: { block: 0, offset: 11 } });
    editor.focus();
    editor.root.dispatchEvent(new InputEvent("beforeinput", { inputType: "insertParagraph", bubbles: true, cancelable: true }));
    expect(editor.getMarkdown()).toBe("- [ ] first\n- [ ] ");
  });
});
