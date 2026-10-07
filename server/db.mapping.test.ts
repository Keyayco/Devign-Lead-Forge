import { describe, expect, it } from "vitest";
import { composeLeadText, parseLeadText } from "./db";

describe("lead address and notes mapping", () => {
  it("round-trips distinct address and notes values", () => {
    const stored = composeLeadText(
      "ADDRESS_TEST_123",
      "https://example.com/demo",
      "NOTES_TEST_456"
    );

    expect(parseLeadText(stored)).toEqual({
      address: "ADDRESS_TEST_123",
      demoLink: "https://example.com/demo",
      notes: "NOTES_TEST_456",
    });
    expect(stored).not.toContain("ADDRESS_TEST_123\nNOTES_TEST_456");
  });

  it("preserves multiline notes instead of treating them as address", () => {
    const stored = composeLeadText(
      "ADDRESS_EDIT_789",
      "",
      "NOTES_EDIT_012\nFollow up Friday."
    );

    expect(parseLeadText(stored)).toEqual({
      address: "ADDRESS_EDIT_789",
      demoLink: "",
      notes: "NOTES_EDIT_012\nFollow up Friday.",
    });
  });

  it("reads legacy unprefixed address plus Notes marker safely", () => {
    expect(
      parseLeadText(
        "ADDRESS_TEST_123\nNotes: NOTES_TEST_456\nDemo Link: https://example.com/demo"
      )
    ).toEqual({
      address: "ADDRESS_TEST_123",
      demoLink: "https://example.com/demo",
      notes: "NOTES_TEST_456",
    });
  });
});
