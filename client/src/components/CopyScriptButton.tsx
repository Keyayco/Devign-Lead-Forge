import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function CopyScriptButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  async function copyExample() {
    if (!content) {
      toast.error("No copyable example is available");
      return;
    }
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Script copied");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Copy was blocked. Select the example text manually.");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={copyExample}
      aria-label="Copy the isolated example script"
      className="shrink-0 rounded-xl border-slate-200 bg-white"
    >
      {copied ? (
        <Check className="mr-2 h-4 w-4 text-emerald-600" />
      ) : (
        <Copy className="mr-2 h-4 w-4" />
      )}
      {copied ? "Copied" : "Copy script"}
    </Button>
  );
}
