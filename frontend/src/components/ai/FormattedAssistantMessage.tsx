"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] };

function parseAssistantContent(content: string): ContentBlock[] {
  const normalized = content.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const blocks: ContentBlock[] = [];
  let paragraphBuffer: string[] = [];
  let index = 0;

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    blocks.push({
      type: "paragraph",
      text: paragraphBuffer.join(" ").replace(/\s+/g, " ").trim(),
    });
    paragraphBuffer = [];
  };

  while (index < lines.length) {
    const rawLine = lines[index] ?? "";
    const trimmedLine = rawLine.trim();

    if (!trimmedLine) {
      flushParagraph();
      index += 1;
      continue;
    }

    const unorderedMatch = trimmedLine.match(/^[-*]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length) {
        const current = (lines[index] ?? "").trim();
        const match = current.match(/^[-*]\s+(.+)$/);
        if (!match) break;
        items.push(match[1].trim());
        index += 1;
      }
      if (items.length > 0) {
        blocks.push({ type: "unordered-list", items });
      }
      continue;
    }

    const orderedMatch = trimmedLine.match(/^\d+[.)]\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length) {
        const current = (lines[index] ?? "").trim();
        const match = current.match(/^\d+[.)]\s+(.+)$/);
        if (!match) break;
        items.push(match[1].trim());
        index += 1;
      }
      if (items.length > 0) {
        blocks.push({ type: "ordered-list", items });
      }
      continue;
    }

    paragraphBuffer.push(trimmedLine);
    index += 1;
  }

  flushParagraph();
  return blocks;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`strong-${index}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={`em-${index}`}>{part.slice(1, -1)}</em>;
    }
    return <span key={`text-${index}`}>{part}</span>;
  });
}

interface FormattedAssistantMessageProps {
  content: string;
  className?: string;
}

export function FormattedAssistantMessage({
  content,
  className,
}: FormattedAssistantMessageProps) {
  const blocks = parseAssistantContent(content);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-3 text-sm leading-6", className)}>
      {blocks.map((block, blockIndex) => {
        if (block.type === "paragraph") {
          return <p key={`p-${blockIndex}`}>{renderInlineMarkdown(block.text)}</p>;
        }

        if (block.type === "unordered-list") {
          return (
            <ul key={`ul-${blockIndex}`} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={`ul-item-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
              ))}
            </ul>
          );
        }

        return (
          <ol key={`ol-${blockIndex}`} className="list-decimal space-y-1 pl-5">
            {block.items.map((item, itemIndex) => (
              <li key={`ol-item-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
            ))}
          </ol>
        );
      })}
    </div>
  );
}
