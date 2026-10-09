// @vitest-environment jsdom

import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { guideSections } from "@/lib/salesOpsContent";
import { ResourceLayout } from "./ResourceLayout";

vi.mock("wouter", () => ({
  useLocation: () => ["/guide", vi.fn()],
}));

vi.mock("./MarkdownContent", () => ({
  MarkdownContent: ({ content }: { content: string }) => <div>{content}</div>,
}));

vi.mock("./CopyScriptButton", () => ({
  CopyScriptButton: () => <button type="button">Copy script</button>,
}));

afterEach(cleanup);

describe("ResourceLayout", () => {
  it("renders sections and filters them through the local search", () => {
    render(<ResourceLayout kind="guide" sections={guideSections} />);
    expect(screen.getByRole("heading", { name: "Team Guide" })).toBeTruthy();
    expect(screen.getByText("Getting started")).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: "Search guide" }), {
      target: { value: "handover" },
    });

    expect(
      screen.getAllByText("Handover and team accountability").length
    ).toBeGreaterThan(0);
    expect(screen.queryByText("Getting started")).toBeNull();
  });

  it("labels future content and provides an accessible back action", () => {
    render(<ResourceLayout kind="guide" sections={guideSections} />);
    fireEvent.click(
      screen.getByRole("button", { name: /commercial documents/i })
    );
    expect(screen.getByText("Future workflow")).toBeTruthy();
    expect(screen.getByRole("button", { name: /back to leads/i })).toBeTruthy();
  });
});
