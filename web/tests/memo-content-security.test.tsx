import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";
import { isTrustedIframeSrc, SANITIZE_SCHEMA } from "@/components/MemoContent/constants";
import { buildRehypePlugins } from "@/components/MemoContent/pipeline";
import { TrustedIframe } from "@/components/MemoContent/TrustedIframe";
import { remarkCurrencySafeMath } from "@/utils/remark-plugins/remark-currency-safe-math";

const renderMemoContent = (content: string): string =>
  renderToStaticMarkup(
    <ReactMarkdown
      remarkPlugins={[remarkCurrencySafeMath]}
      rehypePlugins={buildRehypePlugins([[rehypeKatex, { throwOnError: false, strict: false }]])}
      components={{ iframe: TrustedIframe }}
    >
      {content}
    </ReactMarkdown>,
  );

const renderGfmContent = (content: string): string =>
  renderToStaticMarkup(
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeSanitize, SANITIZE_SCHEMA]]}>
      {content}
    </ReactMarkdown>,
  );

describe("memo content sanitization", () => {
  it("strips user-controlled inline styles from raw HTML spans", () => {
    const html = renderMemoContent('<span style="position:fixed;inset:0;z-index:99999">overlay</span>');

    expect(html).toMatch(/<span>overlay<\/span>/);
    expect(html).not.toMatch(/style=/);
    expect(html).not.toMatch(/position:fixed/);
  });

  it("still renders KaTeX output after sanitizing math marker classes", () => {
    const html = renderMemoContent("$L$");

    expect(html).toMatch(/class="katex"/);
    expect(html).toMatch(/class="katex-html"/);
  });

  it("preserves checked state for GFM task list items", () => {
    const html = renderGfmContent("- [x] Done\n- [ ] Todo");
    const inputs = html.match(/<input[^>]+\/>/g) ?? [];

    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toContain('checked=""');
    expect(inputs[1]).not.toContain('checked=""');
  });
});

describe("trusted iframe providers", () => {
  it("renders Bilibili share snippets over HTTPS without autoplay by default", () => {
    const html = renderMemoContent('<iframe src="//player.bilibili.com/player.html?bvid=BV1xx411c7mD&p=1" allowfullscreen></iframe>');
    expect(html).toContain('src="https://player.bilibili.com/player.html?bvid=BV1xx411c7mD&amp;p=1&amp;autoplay=0"');
    expect(html).toMatch(/class="[^"]*w-full[^"]*aspect-video/);
    expect(
      renderMemoContent('<iframe src="HTTPS://player.bilibili.com/player.html?autoplay=1" width="640" height="360"></iframe>'),
    ).toContain('autoplay=1"');
    expect(renderMemoContent('<iframe src="https://player.bilibili.com/player.html" width="640" height="360"></iframe>')).not.toContain(
      "aspect-video",
    );
  });

  it.each([
    "http://player.bilibili.com/player.html",
    "//player.bilibili.com.evil.example/player.html",
    "https://player.bilibili.com@evil.example/player.html",
    "https://player.bilibili.com/video/BV1xx411c7mD",
  ])("rejects an untrusted Bilibili source: %s", (src) => {
    expect(renderMemoContent(`<iframe src="${src}"></iframe>`)).not.toMatch(/<iframe/);
  });

  it("normalizes trusted iframe source schemes without allowing plain HTTP", () => {
    expect(renderMemoContent('<iframe src="//www.youtube.com/embed/abc123"></iframe>')).toContain(
      'src="https://www.youtube.com/embed/abc123"',
    );
    expect(renderMemoContent('<iframe src=" HTTPS://www.youtube.com/embed/abc123"></iframe>')).toContain(
      'src="https://www.youtube.com/embed/abc123"',
    );
    expect(renderMemoContent('<iframe src="http://www.youtube.com/embed/abc123"></iframe>')).not.toMatch(/<iframe/);
  });

  it("accepts trusted providers only", () => {
    expect(isTrustedIframeSrc("https://www.youtube.com/embed/abc123")).toBe(true);
    expect(isTrustedIframeSrc("https://www.youtube-nocookie.com/embed/abc123?si=test")).toBe(true);
    expect(isTrustedIframeSrc("https://player.vimeo.com/video/123456")).toBe(true);
    expect(isTrustedIframeSrc("https://open.spotify.com/embed/track/123456")).toBe(true);
    expect(isTrustedIframeSrc("https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/123456")).toBe(true);
    expect(isTrustedIframeSrc("https://www.loom.com/embed/123456")).toBe(true);
    expect(isTrustedIframeSrc("https://www.google.com/maps/embed?pb=test")).toBe(true);
    expect(isTrustedIframeSrc("https://app.diagrams.net/?embed=1")).toBe(true);
    expect(isTrustedIframeSrc("https://www.draw.io/?embed=1")).toBe(true);
    expect(isTrustedIframeSrc("https://evil.example/embed/abc123")).toBe(false);
  });

  it("drops untrusted iframe embeds during rendering", () => {
    const trusted = renderMemoContent('<iframe src="https://www.youtube.com/embed/abc123" title="demo"></iframe>');
    const untrusted = renderMemoContent('<iframe src="https://evil.example/embed/abc123" title="demo"></iframe>');

    expect(trusted).toMatch(/<iframe/);
    expect(trusted).toMatch(/youtube\.com\/embed\/abc123/);
    expect(untrusted).not.toMatch(/<iframe/);
  });
});
