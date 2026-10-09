import { Streamdown } from "streamdown";

type MarkdownContentProps = {
  content: string;
  isPlaybook?: boolean;
};

export function MarkdownContent({
  content,
  isPlaybook = false,
}: MarkdownContentProps) {
  return (
    <div className="prose prose-slate max-w-none prose-headings:scroll-mt-24 prose-headings:font-bold prose-a:text-slate-900 prose-a:underline prose-blockquote:border-slate-300 prose-blockquote:text-slate-600 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none prose-li:marker:text-slate-400 prose-p:leading-7 prose-strong:text-slate-900">
      <Streamdown
        controls={false}
        parseIncompleteMarkdown={false}
        rehypePlugins={[]}
        remarkPlugins={[]}
        components={{
          blockquote: ({ children }) => (
            <blockquote
              className={
                isPlaybook
                  ? "rounded-xl border-l-4 bg-slate-50 px-4 py-3 not-italic"
                  : undefined
              }
            >
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </Streamdown>
    </div>
  );
}
