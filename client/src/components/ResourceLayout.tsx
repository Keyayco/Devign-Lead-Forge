import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import * as React from "react";
import {
  ArrowLeft,
  BookOpen,
  CircleAlert,
  Library,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { MarkdownContent } from "./MarkdownContent";
import { CopyScriptButton } from "./CopyScriptButton";
import type { ResourceKind, ResourceSection } from "@/lib/salesOpsContent";
import {
  SALES_CONTENT_REVISION,
  searchResourceSections,
} from "@/lib/salesOpsContent";

type ResourceLayoutProps = {
  kind: ResourceKind;
  sections: ResourceSection[];
};

export function ResourceLayout({ kind, sections }: ResourceLayoutProps) {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [selectedSlug, setSelectedSlug] = useState(sections[0]?.slug ?? "");
  const filteredSections = useMemo(
    () => searchResourceSections(sections, query),
    [query, sections]
  );
  const selected =
    filteredSections.find(section => section.slug === selectedSlug) ??
    filteredSections[0] ??
    sections.find(section => section.slug === selectedSlug) ??
    sections[0];
  const isPlaybook = kind === "playbook";

  return (
    <div className="min-h-screen bg-[#f6f7f9] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Button
              variant="ghost"
              className="-ml-3 mb-2 h-8 px-3 text-slate-500 hover:text-slate-950"
              onClick={() => setLocation("/")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Leads
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
                {isPlaybook ? (
                  <Library className="h-5 w-5" />
                ) : (
                  <BookOpen className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  Devign Sales Operations Hub
                </p>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                  {isPlaybook ? "Sales Playbook" : "Team Guide"}
                </h1>
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              {isPlaybook
                ? "Respectful, reusable guidance for research, outreach, demos and handover."
                : "Practical instructions for using Lead Forge and working consistently as a Devign team."}
            </p>
          </div>
          <Badge
            variant="outline"
            className="w-fit rounded-full bg-white px-3 py-1 text-slate-500"
          >
            Published content · {SALES_CONTENT_REVISION}
          </Badge>
        </div>

        <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Card className="h-fit rounded-2xl border-slate-200 bg-white shadow-sm lg:sticky lg:top-6">
            <CardHeader className="space-y-3 pb-3">
              <CardTitle className="text-sm text-slate-900">
                Find a section
              </CardTitle>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder={
                    isPlaybook ? "Search situations..." : "Search the guide..."
                  }
                  aria-label={`Search ${isPlaybook ? "playbook" : "guide"}`}
                  className="h-10 rounded-xl border-slate-200 pl-9 text-sm"
                />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="max-h-[55vh] pr-2 lg:max-h-[calc(100vh-15rem)]">
                <nav
                  aria-label={`${isPlaybook ? "Playbook" : "Guide"} sections`}
                  className="space-y-1"
                >
                  {filteredSections.map(section => (
                    <button
                      key={section.slug}
                      type="button"
                      onClick={() => setSelectedSlug(section.slug)}
                      className={cn(
                        "w-full rounded-xl px-3 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950",
                        selected?.slug === section.slug
                          ? "bg-slate-950 text-white"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                      )}
                    >
                      <span className="flex items-start gap-2">
                        <span className="mt-0.5 text-[10px] font-bold opacity-60">
                          {String(section.order).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold leading-5">
                            {section.title}
                          </span>
                          <span
                            className={cn(
                              "mt-1 block text-xs leading-4",
                              selected?.slug === section.slug
                                ? "text-slate-300"
                                : "text-slate-400"
                            )}
                          >
                            {section.summary}
                          </span>
                        </span>
                      </span>
                    </button>
                  ))}
                </nav>
                {filteredSections.length === 0 && (
                  <div className="py-8 text-center text-sm text-slate-500">
                    <Search className="mx-auto mb-2 h-5 w-5 text-slate-300" />
                    No sections match “{query}”.
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="min-w-0 rounded-2xl border-slate-200 bg-white shadow-sm">
            {selected ? (
              <CardContent className="p-5 sm:p-8 lg:p-10">
                <div className="mb-6 flex flex-col gap-3 border-b border-slate-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className="rounded-full text-[10px] uppercase tracking-wider text-slate-500"
                      >
                        Section {String(selected.order).padStart(2, "0")}
                      </Badge>
                      {selected.futureOnly && (
                        <Badge className="rounded-full bg-amber-100 text-amber-800 hover:bg-amber-100">
                          Future workflow
                        </Badge>
                      )}
                    </div>
                    <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                      {selected.title}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {selected.summary}
                    </p>
                  </div>
                  {isPlaybook && (
                    <CopyScriptButton
                      content={extractExample(selected.content)}
                    />
                  )}
                </div>
                <MarkdownContent
                  content={selected.content}
                  isPlaybook={isPlaybook}
                />
              </CardContent>
            ) : (
              <CardContent className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
                <CircleAlert className="mb-3 h-6 w-6 text-slate-300" />
                <p className="font-semibold text-slate-800">
                  This resource is not available
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Please refresh or report the missing section to the team.
                </p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function extractExample(markdown: string) {
  const match = markdown.match(/## Copyable example\n\n((?:>.*(?:\n|$))+)/);
  return (
    match?.[1]
      .split("\n")
      .map(line => line.replace(/^> ?/, ""))
      .join("\n")
      .trim() ?? ""
  );
}
