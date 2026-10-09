export type ResourceKind = "guide" | "playbook";

export type ResourceSection = {
  slug: string;
  title: string;
  summary: string;
  kind: ResourceKind;
  order: number;
  futureOnly?: boolean;
  content: string;
};

export const SALES_CONTENT_REVISION = "Phase 1 · revision 1";

const guideMeta = [
  [
    "01-purpose-and-process",
    "Purpose and the Devign sales process",
    "How Lead Forge supports a clear, respectful sales workflow.",
  ],
  [
    "02-getting-started",
    "Getting started",
    "Sign in, navigate the workspace and understand the mobile layout.",
  ],
  [
    "03-lead-workflow",
    "The lead workflow",
    "Find, create, edit and claim leads safely.",
  ],
  [
    "04-statuses-demo-flow-and-outreach",
    "Statuses, demos, FLOW and outreach",
    "Use the current lead, demo and outreach states consistently.",
  ],
  [
    "05-research-and-qualification",
    "Research and qualification",
    "Turn basic prospect research into useful lead context.",
  ],
  [
    "06-recording-outreach-and-notes",
    "Recording outreach and notes",
    "Capture facts, commitments and next steps accurately.",
  ],
  [
    "07-demo-preparation-and-presentation",
    "Demo preparation and presentation",
    "Prepare a focused, honest demonstration.",
  ],
  [
    "08-follow-ups-and-stopping-rules",
    "Follow-ups and stopping rules",
    "Record follow-up context and communicate respectfully.",
  ],
  [
    "09-commercial-documents-future",
    "Commercial documents",
    "Future guidance for approved pricing and contract documents.",
  ],
  [
    "10-handover-and-team-accountability",
    "Handover and team accountability",
    "Make ownership and next actions visible to the team.",
  ],
  [
    "11-github-fundamentals",
    "GitHub fundamentals",
    "A plain-language introduction for non-technical team members.",
  ],
  [
    "12-android-and-termux-optional",
    "Android and Termux",
    "Optional technical guidance without inventing device paths.",
  ],
  [
    "13-troubleshooting-and-escalation",
    "Troubleshooting and escalation",
    "What to check before asking for help.",
  ],
] as const;

const playbookMeta = [
  [
    "01-research-and-qualification",
    "Research and qualification",
    "A practical checklist before first contact.",
  ],
  [
    "02-first-contact-messages",
    "Personalised first-contact messages",
    "Respectful examples for an initial message.",
  ],
  [
    "03-call-opening-and-discovery",
    "Call opening and discovery",
    "Open well and learn before presenting.",
  ],
  [
    "04-demo-preparation-and-presentation",
    "Demo preparation and presentation",
    "Connect the demonstration to the prospect's needs.",
  ],
  [
    "05-post-demo-follow-up",
    "Post-demo follow-up",
    "Close the loop after a demonstration.",
  ],
  [
    "06-no-answer-and-voicemail",
    "No-answer and voicemail",
    "Leave a useful, low-pressure message.",
  ],
  [
    "07-contact-me-later",
    "Contact me later",
    "Respond when timing is not right.",
  ],
  [
    "08-not-interested-and-respectful-closure",
    "Not interested and respectful closure",
    "Close cleanly when the answer is no.",
  ],
  [
    "09-price-and-affordability",
    "Price and affordability",
    "Explore value without inventing terms.",
  ],
  [
    "10-trust-timing-provider-and-diy",
    "Trust, timing, provider and DIY objections",
    "Handle common concerns honestly.",
  ],
  [
    "11-free-work-requests",
    "Requests for free work",
    "Protect scope while remaining helpful.",
  ],
  [
    "12-negotiation-scope-and-closing",
    "Negotiation, scope and closing",
    "Clarify the next decision without pressure.",
  ],
  [
    "13-sale-handover",
    "Handover after a sale",
    "Give the next teammate a clear starting point.",
  ],
] as const;

const guideModules = import.meta.glob("../../../docs/sales-ops/guide/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const playbookModules = import.meta.glob(
  "../../../docs/sales-ops/playbook/*.md",
  {
    query: "?raw",
    import: "default",
    eager: true,
  }
) as Record<string, string>;

function loadModule(
  modules: Record<string, string>,
  slug: string,
  kind: ResourceKind
) {
  const path = Object.keys(modules).find(file => file.endsWith(`/${slug}.md`));
  if (!path || typeof modules[path] !== "string") {
    throw new Error(`Missing ${kind} Markdown section: ${slug}`);
  }
  return modules[path];
}

function buildSections(
  kind: ResourceKind,
  metadata: readonly (readonly [string, string, string])[],
  modules: Record<string, string>
): ResourceSection[] {
  const slugs = metadata.map(([slug]) => slug);
  if (new Set(slugs).size !== slugs.length) {
    throw new Error(`Duplicate ${kind} Markdown slug in content manifest`);
  }

  return metadata.map(([slug, title, summary], index) => ({
    slug,
    title,
    summary,
    kind,
    order: index + 1,
    futureOnly: slug === "09-commercial-documents-future",
    content: loadModule(modules, slug, kind),
  }));
}

export const guideSections = buildSections("guide", guideMeta, guideModules);
export const playbookSections = buildSections(
  "playbook",
  playbookMeta,
  playbookModules
);

export function getResourceSections(kind: ResourceKind) {
  return kind === "guide" ? guideSections : playbookSections;
}

export function searchResourceSections(
  sections: ResourceSection[],
  query: string
) {
  const normalised = query.trim().toLowerCase();
  if (!normalised) return sections;
  return sections.filter(section =>
    [section.title, section.summary, section.content]
      .join(" ")
      .toLowerCase()
      .includes(normalised)
  );
}
