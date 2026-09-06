import { Fragment, type ReactNode } from "react";

function inlineMarkdown(value: string): ReactNode[] {
  const parts = value.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="rounded bg-background/70 px-1 py-0.5 text-[0.9em]">{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function MarkdownText({ content }: { content: string }) {
  return (
    <div className="space-y-2 leading-relaxed">
      {content.split("\n").map((line, index) => {
        if (!line.trim()) return <div key={index} className="h-1" />;
        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        if (heading) return <p key={index} className="font-semibold">{inlineMarkdown(heading[2])}</p>;
        const bullet = line.match(/^\s*[-*]\s+(.+)$/);
        if (bullet) return <p key={index} className="pl-3 before:mr-2 before:content-['•']">{inlineMarkdown(bullet[1])}</p>;
        return <p key={index}>{inlineMarkdown(line)}</p>;
      })}
    </div>
  );
}
