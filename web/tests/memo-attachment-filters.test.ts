import { describe, expect, it } from "vitest";
import { parseFilterQuery, stringifyFilters } from "@/contexts/MemoFilterContext";
import { buildMemoFilter } from "@/hooks/useMemoFilters";

describe("memo attachment filters", () => {
  it("preserves facets through URLs and combines them with text and mood filters", () => {
    const filters = [
      { factor: "hasAttachments", value: "true" },
      { factor: "hasImage", value: "true" },
      { factor: "contentSearch", value: "trip" },
      { factor: "moodLevel", value: "5" },
    ] as const;
    const restored = parseFilterQuery(stringifyFilters([...filters]));
    expect(restored).toEqual(filters);
    const result = buildMemoFilter({ filters: restored, includePinned: false });
    expect(result).toContain("has_attachments");
    expect(result).toContain("has_image");
    expect(result).toContain('content.contains("trip")');
    expect(result).toContain("mood_level == 5");
  });
});
