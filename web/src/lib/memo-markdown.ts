import {
  type Block,
  type Doc,
  defaultResolveUrl,
  type Extension,
  footnotes,
  isPlainTextBlock,
  isTextBlock,
  type Labels,
  type MarkdownOptions,
  math,
  mentions,
  parseMarkdown,
  type ResolveUrl,
  type Span,
  scanTags,
  type TagScanner,
  type Theme,
  tags,
} from "@usememos/editor";
import { headingClass, markdownStyles } from "@/lib/markdownStyles";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import type { useTranslate } from "@/utils/i18n";
import { resolveManagedAttachmentImageSource } from "@/utils/managed-attachment";

export const MEMO_MARKDOWN: MarkdownOptions = { breaks: true, setext: false };

type KatexModule = typeof import("katex").default;

let katexModule: KatexModule | null = null;
let katexPromise: Promise<KatexModule> | null = null;

/** Loads KaTeX and its stylesheet once. */
const loadKatex = (): Promise<KatexModule> => {
  katexPromise ??= Promise.all([import("katex"), import("katex/dist/katex.min.css")]).then(([module]) => {
    katexModule = module.default;
    return katexModule;
  });
  return katexPromise;
};

/** Renders TeX with KaTeX, loading it the first time; the editor shows the source meanwhile. */
const renderMath = (tex: string, element: HTMLElement, { displayMode }: { readonly displayMode: boolean }) => {
  const render = (katex: KatexModule) => katex.render(tex, element, { displayMode, throwOnError: false, strict: false });
  if (katexModule) return render(katexModule);
  return loadKatex().then(render);
};

export const memoExtensions = (): Extension[] => [
  math({ render: renderMath }),
  footnotes(),
  tags(),
  mentions(),
  {
    name: "memoHtml",
    views: {
      html: async (source, target, kind) => {
        const { renderSanitizedHtml } = await import("@/lib/sanitized-html");
        renderSanitizedHtml(source, target, kind);
      },
    },
  },
];

/** Images load from relative URLs and https only, as memos' sanitizer allowed; anything else is dropped. */
const isAllowedImageSource = (src: string): boolean => !/^[a-z][a-z0-9+.-]*:/i.test(src) || /^https:/i.test(src);

/**
 * memos' URL policy: images the memo names load from relative or https URLs only, and
 * managed attachment images then resolve to their served URL, which is the instance's
 * own origin and may be plain http. Links also allow `sms:`, which hands off to another
 * app, beyond the editor's defaults.
 */
export const memoResolveUrl =
  (attachments: readonly Attachment[] = []): ResolveUrl =>
  (url, kind) => {
    if (kind === "image") {
      return isAllowedImageSource(url) ? (resolveManagedAttachmentImageSource(url, [...attachments]) ?? url) : null;
    }
    return /^sms:/i.test(url.trim()) ? url.trim() : defaultResolveUrl(url, kind);
  };

export const MEMO_EDITOR_THEME: Theme = (() => {
  const colors = {
    text: "var(--foreground)",
    muted: "var(--muted-foreground)",
    background: "transparent",
    accent: "var(--primary)",
    link: "var(--primary)",
    codeBackground: "var(--muted)",
    border: "var(--border)",
    popupBackground: "var(--popover)",
    popupBorder: "var(--border)",
    hover: "var(--accent)",
    danger: "var(--destructive)",
  };
  return {
    colorScheme: "inherit",
    tokens: {
      colors,
      font: "inherit",
      mono: "var(--font-mono, ui-monospace, monospace)",
      fontSize: 16,
      lineHeight: 24,
      radius: "calc(var(--radius) - 2px)",
      blockGap: 8,
    },
    classes: {
      heading: { 1: headingClass(1), 2: headingClass(2), 3: headingClass(3), 4: headingClass(4), 5: headingClass(5), 6: headingClass(6) },
      code: markdownStyles.inlineCode,
      link: markdownStyles.link,
      // The editor sizes and spaces its images; raw HTML images keep markdownStyles.image.
      image: "rounded-lg",
    },
  };
})();

/** The composer's look in focus mode: the same theme, set larger for writing at length. */
export const MEMO_FOCUS_EDITOR_THEME: Theme = {
  ...MEMO_EDITOR_THEME,
  tokens: { ...MEMO_EDITOR_THEME.tokens, fontSize: 17, lineHeight: 28 },
};

/** The editor's UI strings in the user's language. */
export const memoEditorLabels = (t: ReturnType<typeof useTranslate>): Partial<Labels> => ({
  text: t("editor.format.paragraph"),
  heading1: t("editor.format.heading-1"),
  heading2: t("editor.format.heading-2"),
  heading3: t("editor.format.heading-3"),
  heading4: t("editor.format.heading-4"),
  bulletList: t("editor.format.bullet-list"),
  numberedList: t("editor.format.ordered-list"),
  todoList: t("editor.format.task-list"),
  task: t("editor.blocks.task"),
  quote: t("editor.blocks.quote"),
  callout: t("editor.blocks.callout"),
  calloutNote: t("editor.blocks.callout-note"),
  calloutTip: t("editor.blocks.callout-tip"),
  calloutImportant: t("editor.blocks.callout-important"),
  calloutWarning: t("editor.blocks.callout-warning"),
  calloutCaution: t("editor.blocks.callout-caution"),
  details: t("editor.blocks.collapsible-section"),
  detailsHint: t("common.title"),
  expandSection: t("common.expand"),
  collapseSection: t("common.collapse"),
  code: t("editor.format.code-block"),
  table: t("editor.blocks.table"),
  divider: t("editor.blocks.divider"),
  noResults: t("editor.blocks.no-results"),
  suggestions: t("editor.suggestions"),
  commands: t("editor.blocks.commands"),
  loading: t("editor.blocks.loading"),
  duplicate: t("editor.blocks.duplicate"),
  delete: t("common.delete"),
  bold: t("editor.format.bold"),
  italic: t("editor.format.italic"),
  strike: t("editor.format.strikethrough"),
  inlineCode: t("editor.blocks.inline-code"),
  link: t("editor.format.link"),
  textStyle: t("editor.blocks.text-style"),
  list: t("editor.blocks.list-hint"),
  linkPlaceholder: t("editor.blocks.link-placeholder"),
  removeLink: t("editor.blocks.remove-link"),
  openLink: t("editor.blocks.open-link"),
  copyLink: t("editor.blocks.copy-link"),
  editLink: t("editor.blocks.edit-link"),
  blockHandle: t("editor.blocks.block-menu"),
  listHint: t("editor.blocks.list-hint"),
  quoteHint: t("editor.blocks.quote"),
  language: t("common.language"),
  plainText: t("editor.blocks.plain-text"),
  copyCode: t("common.copy"),
  copied: t("message.copied"),
  addRowAbove: t("editor.blocks.add-row-above"),
  addRowBelow: t("editor.blocks.add-row-below"),
  addColumnLeft: t("editor.blocks.add-column-left"),
  addColumnRight: t("editor.blocks.add-column-right"),
  deleteRow: t("editor.blocks.delete-row"),
  deleteColumn: t("editor.blocks.delete-column"),
  align: t("editor.blocks.align"),
  alignLeft: t("editor.blocks.align-left"),
  alignCenter: t("editor.blocks.align-center"),
  alignRight: t("editor.blocks.align-right"),
  tableSection: t("editor.blocks.table"),
  imageSection: t("editor.blocks.image"),
  imageAlignLeft: t("editor.blocks.image-align-left"),
  imageAlignCenter: t("editor.blocks.image-align-center"),
  imageAlignRight: t("editor.blocks.image-align-right"),
  resetImageSize: t("editor.blocks.reset-image-size"),
  altText: t("editor.blocks.alt-text"),
  altTextPlaceholder: t("editor.blocks.alt-text-placeholder"),
  imageUnavailable: t("editor.blocks.image-unavailable"),
  resizeImage: t("editor.blocks.resize-image"),
  footnotes: t("editor.footnotes"),
  backToReference: t("editor.back-to-reference"),
});

/** Whether a span is literal text for tags: not code, raw HTML, a link, an image, or an extension token. */
const isLiteralSpan = (span: Span): boolean =>
  Boolean(span.link || span.image || span.token || span.marks.includes("code") || span.marks.includes("html"));

/** The inline containers of a block: its content, or every table cell. */
function* blockContainers(block: Block): Generator<readonly Span[]> {
  if (block.type === "table") {
    for (const row of block.rows) for (const cell of row) yield cell;
    return;
  }
  if (isTextBlock(block) && !isPlainTextBlock(block)) yield block.content;
}

/**
 * Matches of `scan` in a document, without the trigger, in order and without
 * duplicates. Each run of text with one format is scanned on its own, as the
 * editor's `tags()` and `mentions()` highlighting does, so code, links and
 * other literal text never count.
 */
const collectMatches = (blocks: readonly Block[], scan: TagScanner): string[] => {
  const found = new Set<string>();
  for (const block of blocks) {
    for (const content of blockContainers(block)) {
      for (const span of content) {
        if (isLiteralSpan(span)) continue;
        for (const range of scan(span.text, 0, span.text.length)) found.add(span.text.slice(range.from + 1, range.to));
      }
    }
  }
  return [...found];
};

/** Tags written in a document, as highlighted: `#work/project` gives `work/project`. */
export const collectTags = (blocks: readonly Block[]): string[] => collectMatches(blocks, scanTags);

// The syntax the memo extensions add (math, footnotes, and the escapes of tags and mentions), for parsing outside an editor.
const MEMO_SYNTAX = memoExtensions().flatMap((extension) => (extension.markdown ? [extension.markdown] : []));

/** Parses a memo the way the composer and the memo view read it. */
export const parseMemoMarkdown = (markdown: string): Doc => parseMarkdown(markdown, { ...MEMO_MARKDOWN, syntax: MEMO_SYNTAX });
