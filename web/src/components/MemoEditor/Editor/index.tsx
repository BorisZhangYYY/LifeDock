import { type EditorMode, Editor as MarkdownEditor } from "@usememos/editor";
import "@usememos/editor/style.css";
import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import { useTagCounts } from "@/hooks/useUserQueries";
import {
  MEMO_EDITOR_THEME,
  MEMO_FOCUS_EDITOR_THEME,
  MEMO_MARKDOWN,
  memoEditorLabels,
  memoExtensions,
  memoResolveUrl,
} from "@/lib/memo-markdown";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { useTranslate } from "@/utils/i18n";
import type { EditorController } from "../types/editorController";
import { createController } from "./controller";
import { buildEditorExtensions, type EditorFileOrigin } from "./extensions";
import "./editor.css";

interface EditorProps {
  className: string;
  initialContent: string;
  contentIsExternal?: boolean;
  placeholder: string;
  onContentChange: (content: string) => void;
  onExternalContentApplied?: (content: string) => void;
  onFiles: (files: File[], origin: EditorFileOrigin) => void;
  onSubmit: () => void;
  isFocusMode?: boolean;
  mode?: EditorMode;
  attachments?: readonly Attachment[];
}

/** Upstream Markdown engine behind LifeDock's existing composer contract. */
const Editor = forwardRef(function Editor(props: EditorProps, ref: React.ForwardedRef<EditorController>) {
  const { className, initialContent, contentIsExternal = true, placeholder, isFocusMode, mode = "rich", attachments } = props;
  const t = useTranslate();
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MarkdownEditor | null>(null);
  const propsRef = useRef(props);
  const pendingExternalRef = useRef<string | null>(null);
  const { data: tagData } = useTagCounts(true);
  const tagsRef = useRef<string[]>([]);
  tagsRef.current = useMemo(() => Object.keys(tagData ?? {}), [tagData]);
  useLayoutEffect(() => {
    propsRef.current = props;
  });
  const controller = useMemo(
    () =>
      createController(
        () => editorRef.current,
        (markdown) => propsRef.current.onContentChange(markdown),
      ),
    [],
  );
  useImperativeHandle(ref, () => controller, [controller]);

  const applyExternal = useCallback((markdown: string) => {
    pendingExternalRef.current = null;
    const editor = editorRef.current;
    if (editor && !editor.isDestroyed && editor.getMarkdown() !== markdown) editor.setMarkdown(markdown);
  }, []);

  // Construct before paint so the Home composer has no second loading boundary.
  useLayoutEffect(() => {
    if (!hostRef.current) return;
    const editor = new MarkdownEditor({
      element: hostRef.current,
      content: initialContent,
      placeholder,
      mode,
      markdown: MEMO_MARKDOWN,
      extensions: [
        ...memoExtensions(),
        ...buildEditorExtensions({
          getTags: () => tagsRef.current,
          onFiles: (files, origin) => propsRef.current.onFiles(files, origin),
          emojiLabel: t("editor.blocks.emoji"),
        }),
      ],
      theme: isFocusMode ? MEMO_FOCUS_EDITOR_THEME : MEMO_EDITOR_THEME,
      labels: memoEditorLabels(t),
      resolveUrl: memoResolveUrl(attachments),
      referrerPolicy: "no-referrer",
      attributes: { autocorrect: "on", autocapitalize: "on", spellcheck: "true" },
      onChange: (markdown) => propsRef.current.onContentChange(markdown),
      onSubmit: () => propsRef.current.onSubmit(),
    });
    editorRef.current = editor;
    const onCompositionEnd = () => {
      const pending = pendingExternalRef.current;
      if (pending === null) return;
      applyExternal(pending);
      propsRef.current.onExternalContentApplied?.(pending);
    };
    editor.root.addEventListener("compositionend", onCompositionEnd);
    return () => {
      editor.root.removeEventListener("compositionend", onCompositionEnd);
      editor.destroy();
      editorRef.current = null;
    };
    // The instance lives for one composer mount; live props are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    editorRef.current?.setOptions({
      placeholder,
      mode,
      resolveUrl: memoResolveUrl(attachments),
      theme: isFocusMode ? MEMO_FOCUS_EDITOR_THEME : MEMO_EDITOR_THEME,
    });
  }, [attachments, isFocusMode, mode, placeholder]);
  useLayoutEffect(() => {
    if (!contentIsExternal) return;
    const editor = editorRef.current;
    if (editor?.isComposing) pendingExternalRef.current = initialContent;
    else applyExternal(initialContent);
  }, [applyExternal, contentIsExternal, initialContent]);

  return (
    <div
      className={cn("relative flex w-full flex-col items-start justify-start bg-inherit", isFocusMode && "min-h-0 flex-1", className)}
      data-focus-mode={isFocusMode || undefined}
      data-source-mode={mode === "source" || undefined}
    >
      <div className="memo-editor-scroller w-full text-base">
        <div ref={hostRef} className="memo-editor-root" />
      </div>
    </div>
  );
});
export default Editor;
