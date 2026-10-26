import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Loader2, Maximize2, Minimize2, Send, Sparkles, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { cn } from '../../utils/cn';
import { sendChatMessage, type ChatSource, type ChatTurn } from '../../lib/assistantService';

interface DisplayMessage extends ChatTurn {
  sources?: ChatSource[];
}

const GREETING: DisplayMessage = {
  role: 'assistant',
  content:
    "Hi! I'm the Aimplify Knowledge Specialist. Ask me about published catalog assets, platform families, " +
    "or how workflows like submissions and clone requests work — I'll point you to the right place.",
};

/** Markdown rendering for assistant replies — internal links (/catalog/...) navigate via
 * react-router instead of a full page reload; external links open in a new tab. */
function useMarkdownComponents(onNavigate: (path: string) => void): Components {
  return {
    p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>,
    ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>,
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    h1: ({ children }) => <h3 className="mb-1.5 mt-2 text-[15px] font-bold first:mt-0">{children}</h3>,
    h2: ({ children }) => <h3 className="mb-1.5 mt-2 text-[15px] font-bold first:mt-0">{children}</h3>,
    h3: ({ children }) => <h4 className="mb-1 mt-2 text-sm font-bold first:mt-0">{children}</h4>,
    code: ({ children }) => (
      <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-[12.5px]">{children}</code>
    ),
    a: ({ href, children }) => {
      const isInternal = href?.startsWith('/');
      return (
        <a
          href={href}
          onClick={(e) => {
            if (isInternal && href) {
              e.preventDefault();
              onNavigate(href);
            }
          }}
          target={isInternal ? undefined : '_blank'}
          rel={isInternal ? undefined : 'noopener noreferrer'}
          className="font-medium text-sky-600 underline decoration-sky-300 underline-offset-2 hover:text-sky-700"
        >
          {children}
        </a>
      );
    },
  };
}

/**
 * Global floating chat widget (bottom-right, all authenticated pages).
 * Conversation is session-only by design — no persistence, see docs/knowledge-bot-plan.md §7.
 */
export function ChatWidget() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const goTo = (path: string) => { navigate(path); setOpen(false); };
  const markdownComponents = useMarkdownComponents(goTo);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const history: ChatTurn[] = messages.map(({ role, content }) => ({ role, content }));
    const nextMessages: DisplayMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await sendChatMessage(text, history);
      setMessages((prev) => [...prev, { role: 'assistant', content: response.answer, sources: response.sources }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Sorry, I couldn't reach the knowledge base just now. Please try again in a moment." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'fixed bottom-24 right-6 z-50 flex max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl transition-[width,height] duration-200 ease-out',
              expanded ? 'h-[80vh] w-[560px] max-h-[860px]' : 'h-[560px] max-h-[calc(100dvh-7rem)] w-[380px]'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 bg-sky-600 px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                <div>
                  <p className="text-sm font-semibold leading-tight">Knowledge Specialist</p>
                  <p className="text-[11px] leading-tight text-sky-100">Ask about assets, families & workflows</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-sky-100 hover:bg-sky-500/60 hover:text-white transition-colors"
                  title={expanded ? 'Collapse' : 'Expand'}
                >
                  {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-sky-100 hover:bg-sky-500/60 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-4 py-4">
              {messages.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm',
                      m.role === 'user' ? 'bg-sky-600 text-white' : 'bg-white text-gray-800 border border-gray-100'
                    )}
                  >
                    {m.role === 'assistant' ? (
                      <ReactMarkdown components={markdownComponents}>{m.content}</ReactMarkdown>
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    )}
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-gray-100 pt-2">
                        {m.sources.map((s, si) => (
                          <button
                            key={si}
                            onClick={() => goTo(s.link)}
                            className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100 transition-colors"
                          >
                            {s.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-white px-3.5 py-2.5 text-sm text-gray-400 shadow-sm">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching the knowledge base…
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 border-t border-gray-100 bg-white p-3">
              <input
                maxLength={2000}
                aria-label="Ask the Knowledge Specialist"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleSend(); }}
                placeholder="Ask about an asset, family, or workflow…"
                className="h-10 flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 text-sm outline-none focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100"
              />
              <button
                onClick={() => void handleSend()}
                disabled={loading || !input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-40 disabled:hover:bg-sky-600 transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-sky-600 text-white shadow-xl hover:bg-sky-700 hover:shadow-2xl transition-all"
        title="Ask the Knowledge Specialist"
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </button>
    </>
  );
}
