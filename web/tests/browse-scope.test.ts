import { describe, expect, it } from "vitest";
import { buildBrowseSearch, getBrowseCreator } from "@/lib/browse-scope";

describe("collection creator scope", () => {
  it("defaults to the current creator and keeps Explore mixed", () => {
    for (const path of ["/", "/calendar/2026/10", "/map", "/attachments"]) {
      expect(getBrowseCreator(path, "", "alice")).toBe("alice");
    }
    expect(getBrowseCreator("/Explore/", "", "alice")).toBeUndefined();
    expect(getBrowseCreator("/calendar", "", undefined)).toBeUndefined();
  });
  it("carries explicit authors and all creators across every lens, refresh, and profile links", () => {
    const search = buildBrowseSearch("?filter=tagSearch%3A旅行&selected=memos%2Fone", "bob");
    for (const path of ["/", "/calendar", "/map", "/attachments"]) {
      expect(getBrowseCreator(path, search, "alice")).toBe("bob");
      expect(getBrowseCreator(path, buildBrowseSearch(search), "alice")).toBeUndefined();
    }
    expect(new URLSearchParams(search).get("filter")).toBe("tagSearch:旅行");
    expect(new URLSearchParams(search).has("selected")).toBe(false);
    expect(getBrowseCreator("/u/bob", "", "alice")).toBe("bob");
  });
  it("does not silently widen an empty explicit creator to everyone", () => {
    expect(getBrowseCreator("/map", "?creator=", "alice")).toBe("");
  });
});
