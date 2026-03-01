"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowClockwise,
  ChartLineUp,
  PaperPlaneTilt,
  Wallet,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SAMPLE_QUESTIONS = [
  {
    icon: ChartLineUp,
    text: "Evaluate investment portfolio",
  },
  {
    icon: Wallet,
    text: "Show spending insights",
  },
  {
    icon: WarningCircle,
    text: "Find unusual patterns",
  },
];

const MOCK_RESPONSES: Record<string, string> = {
  default:
    "Based on your spending patterns, I can see a few opportunities to optimize. Your food spending is trending 12% higher than last month. Consider meal prepping on Sundays — users who do this save an average of $47/week.",
  spending:
    "This month you've spent $847 so far. Your predicted total is $1,142 which is 14% over your $1,000 budget. The biggest categories are Food ($312), Entertainment ($198), and Transport ($156).",
  save: "Here are 3 ways to save on food:\n\n1. **Skip eating out on weekdays** — saves ~$85/week\n2. **Use the grocery list feature** — reduces impulse purchases by 23%\n3. **Batch cook on weekends** — average savings of $47/week\n\nWant me to create a challenge around any of these?",
  challenge:
    "You're doing great on your Weekend Warrior challenge! You've spent $85 of your $274 target with 2 days left. You're currently ranked #2 — just $23 behind Jordan Lee. Skip the Jazz Concert on Friday and you'll likely take the #1 spot!",
  budget:
    "Based on your calendar events next week, I predict you'll spend approximately $274. Here's the breakdown:\n\n• **Food & Coffee**: $89\n• **Entertainment**: $95 (Jazz Concert)\n• **Transport**: $53\n• **Other**: $37\n\nI'd suggest a budget of $250 to save an extra $24.",
};

function getResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("spending") || lower.includes("month")) {
    return MOCK_RESPONSES.spending;
  }
  if (lower.includes("save") || lower.includes("food")) {
    return MOCK_RESPONSES.save;
  }
  if (lower.includes("challenge") || lower.includes("track")) {
    return MOCK_RESPONSES.challenge;
  }
  if (lower.includes("budget") || lower.includes("week")) {
    return MOCK_RESPONSES.budget;
  }
  return MOCK_RESPONSES.default;
}

interface AISidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function AiAvatar() {
  return (
    <div
      className="h-8 w-8 shrink-0 antialiased"
      style={{ filter: "drop-shadow(0px 6px 8px rgba(244, 78, 247, 0.10))" }}
    >
      <img src="/ai-dark.svg" alt="AI" className="h-full w-full" />
    </div>
  );
}

function RichAssistantText({ content }: { content: string }) {
  return (
    <div className="prose prose--ai-chat">
      {content.split("\n").map((line, i) => {
        if (!line.trim()) {
          return null;
        }
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return (
          <p key={i}>
            {parts.map((part, j) =>
              j % 2 === 1 ? <strong key={j}>{part}</strong> : <span key={j}>{part}</span>
            )}
          </p>
        );
      })}
    </div>
  );
}

export function AISidebar({ isOpen, onClose }: AISidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) {
        return;
      }

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: content.trim(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }
      setIsStreaming(true);

      let reply = "";
      try {
        if (process.env.NEXT_PUBLIC_API_URL) {
          const res = await api.coachChat(content.trim());
          reply = res.reply.content;
        } else {
          await new Promise((r) => setTimeout(r, 800 + Math.random() * 700));
          reply = getResponse(content);
        }
      } catch {
        await new Promise((r) => setTimeout(r, 800 + Math.random() * 700));
        reply = getResponse(content);
      }

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: reply,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsStreaming(false);
    },
    [isStreaming]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleAutoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 80)}px`;
  };

  const resetChat = () => {
    setMessages([]);
    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  };

  return (
    <div
      className={cn(
        "hidden h-full shrink-0 overflow-y-auto border-l border-primary bg-surface transition-all duration-300 lg:block lg:max-w-[400px]",
        isOpen ? "w-full" : "w-0"
      )}
      style={{ fontFamily: "var(--font-sure-sans)" }}
    >
      <div className="relative h-full">
        <div className="flex h-full shrink-0 flex-col justify-between">
          <div className="px-4 py-4 md:p-4 border-b border-primary">
            <nav className="flex items-center justify-between">
              <div className="flex min-w-0 grow items-center gap-2">
                <button
                  type="button"
                  onClick={resetChat}
                  disabled={messages.length === 0}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-secondary bg-container text-primary transition-colors hover:bg-container-inset disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Start new chat"
                >
                  <ArrowClockwise size={14} weight="bold" />
                </button>

                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-primary">AI Assistant</h2>
                  <p className="truncate text-xs font-medium text-secondary">
                    Private finance context + web insights
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-secondary bg-container text-primary transition-colors hover:bg-container-inset"
                aria-label="Close AI sidebar"
              >
                <X size={14} weight="bold" />
              </button>
            </nav>
          </div>

          <div id="messages" className="grow overflow-y-auto p-4 space-y-6 lg:pb-4">
            {messages.length === 0 && !isStreaming && (
              <div className="mt-auto">
                <div className="flex items-start w-full gap-3 p-2">
                  <AiAvatar />

                  <div className="max-w-[85%] text-sm space-y-4 text-primary">
                    <p>
                      Hey there! I&apos;m an AI/large-language-model that can help with your
                      finances. I have access to your account context.
                    </p>

                    <p>
                      You can use{" "}
                      <span
                        className="bg-container border border-secondary px-1.5 py-0.5 rounded text-xs"
                        style={{ fontFamily: "var(--font-sure-mono)" }}
                      >
                        /
                      </span>{" "}
                      to access commands
                    </p>

                    <div className="space-y-3">
                      <p>Here&apos;s a few questions you can ask:</p>

                      <div className="space-y-2.5">
                        {SAMPLE_QUESTIONS.map((question) => {
                          const Icon = question.icon;
                          return (
                            <button
                              key={question.text}
                              type="button"
                              onClick={() => sendMessage(question.text)}
                              className="w-fit flex items-center gap-2 border border-tertiary rounded-full py-1.5 px-2.5 text-primary transition-colors hover:bg-container-inset"
                            >
                              <Icon size={14} className="text-secondary" />
                              {question.text}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg) =>
              msg.role === "assistant" ? (
                <div key={msg.id} className="flex items-start gap-3 mb-6">
                  <AiAvatar />
                  <RichAssistantText content={msg.content} />
                </div>
              ) : (
                <div
                  key={msg.id}
                  className="bg-surface-inset px-3 py-2 rounded-lg max-w-[85%] w-fit ml-auto mb-6"
                >
                  <div className="prose prose--ai-chat">
                    <p>{msg.content}</p>
                  </div>
                </div>
              )
            )}

            {isStreaming && (
              <div className="flex items-start gap-3">
                <AiAvatar />
                <p className="text-sm text-secondary animate-pulse">Thinking ...</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="shrink-0 px-4 pt-4 pb-4 lg:mt-auto sticky lg:static left-0 bottom-0 w-full bg-surface border-t border-primary">
            <div id="chat-form" className="space-y-2">
              <div className="flex items-center gap-2 bg-container px-3 py-2 rounded-lg shadow-border-xs border border-secondary">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleAutoResize}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything ..."
                  rows={1}
                  className="min-w-0 flex-1 border-0 focus:ring-0 text-sm resize-none px-1 py-1 bg-transparent text-primary placeholder:text-subdued focus:outline-none"
                  style={{ maxHeight: 80, overflow: "hidden" }}
                />

                <div className="flex shrink-0 items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || isStreaming}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-inverse text-inverse transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label="Send message"
                  >
                    <PaperPlaneTilt size={13} weight="fill" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-secondary">
                AI responses are informational only and are not financial advice.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
