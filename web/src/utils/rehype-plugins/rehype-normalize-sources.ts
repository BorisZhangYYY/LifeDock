import type { Root } from "hast";
import { visit } from "unist-util-visit";

const BILIBILI_PLAYER_SRC = /^https:\/\/player\.bilibili\.com\/player\.html(?:\?|$)/i;

/** Normalize shared embed sources before the HTTPS-only sanitizer runs. */
export const rehypeNormalizeSources = () => (tree: Root) => {
  visit(tree, "element", (node) => {
    const src = node.properties.src;
    if (typeof src !== "string") return;
    const trimmed = src.trim();
    let normalized = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed.replace(/^https:/i, "https:");
    if (node.tagName === "iframe" && BILIBILI_PLAYER_SRC.test(normalized)) {
      const url = new URL(normalized);
      if (!url.searchParams.has("autoplay")) url.searchParams.set("autoplay", "0");
      normalized = url.href;
    }
    node.properties.src = normalized;
  });
};
