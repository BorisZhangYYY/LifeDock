import type { Editor } from "@usememos/editor";
import { type EditorCommandId, EMPTY_ACTIVE_FORMATS, toToolbarHeadingLevel } from "../formatting/commands";
import type { FormattingController } from "../types/editorController";

/** Map LifeDock's existing toolbar to the upstream editor commands. */
export function createFormattingController(getEditor: () => Editor | null): FormattingController {
  return {
    run: (command, context) => {
      const editor = getEditor();
      if (!editor || editor.isDestroyed) return;
      const commands = editor.commands;
      const actions: Record<EditorCommandId, () => unknown> = {
        bold: () => commands.toggleBold(),
        italic: () => commands.toggleItalic(),
        strikethrough: () => commands.toggleStrike(),
        code: () => commands.toggleCode(),
        codeBlock: () => commands.toggleCodeBlock(),
        bulletList: () => commands.toggleBulletList(),
        orderedList: () => commands.toggleOrderedList(),
        taskList: () => commands.toggleTaskList(),
        paragraph: () => commands.setParagraph(),
        heading1: () => commands.toggleHeading({ level: 1 }),
        heading2: () => commands.toggleHeading({ level: 2 }),
        heading3: () => commands.toggleHeading({ level: 3 }),
        link: () => (editor.isActive("link") ? commands.unsetLink() : commands.setLink({ href: context?.url ?? "https://" })),
      };
      actions[command]();
      editor.focus();
    },
    getActiveFormats: () => {
      const editor = getEditor();
      if (!editor || editor.isDestroyed) return EMPTY_ACTIVE_FORMATS;
      return {
        bold: editor.isActive("bold"),
        italic: editor.isActive("italic"),
        strikethrough: editor.isActive("strike"),
        code: editor.isActive("code"),
        codeBlock: editor.isActive("codeBlock"),
        bulletList: editor.isActive("bulletList"),
        orderedList: editor.isActive("orderedList"),
        taskList: editor.isActive("taskList"),
        link: editor.isActive("link"),
        headingLevel: toToolbarHeadingLevel(Number(editor.getAttributes("heading").level ?? 0)),
      };
    },
    subscribe: (listener) => {
      const editor = getEditor();
      if (!editor || editor.isDestroyed) return () => {};
      const unsubs = [editor.on("change", listener), editor.on("selectionChange", listener)];
      return () => unsubs.forEach((unsubscribe) => unsubscribe());
    },
  };
}
