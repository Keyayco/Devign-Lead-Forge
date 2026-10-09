import { describe, expect, it } from "vitest";
import {
  guideSections,
  playbookSections,
  searchResourceSections,
} from "./salesOpsContent";

describe("sales operations content", () => {
  it("loads deterministic guide and playbook sections", () => {
    expect(guideSections).toHaveLength(13);
    expect(playbookSections).toHaveLength(13);
    expect(guideSections.map(section => section.order)).toEqual(
      Array.from({ length: 13 }, (_, index) => index + 1)
    );
    expect(new Set(playbookSections.map(section => section.slug)).size).toBe(
      13
    );
  });

  it("includes useful content and labels future workflows", () => {
    expect(guideSections.every(section => section.content.length > 80)).toBe(
      true
    );
    expect(
      guideSections.find(
        section => section.slug === "09-commercial-documents-future"
      )?.futureOnly
    ).toBe(true);
    expect(
      playbookSections.every(section =>
        section.content.includes("## Copyable example")
      )
    ).toBe(true);
  });

  it("searches section metadata and Markdown content", () => {
    expect(
      searchResourceSections(guideSections, "offline").some(
        section => section.slug === "02-getting-started"
      )
    ).toBe(true);
    expect(
      searchResourceSections(playbookSections, "affordability")
    ).toHaveLength(1);
    expect(searchResourceSections(guideSections, "no such topic")).toHaveLength(
      0
    );
  });
});
