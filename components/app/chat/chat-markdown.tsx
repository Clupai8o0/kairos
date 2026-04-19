'use client';

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function ChatMarkdown({ content }: { content: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-fg">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li>{children}</li>,
        code: ({ className, children, ...props }) => {
          const isInline = !className;
          return isInline ? (
            <code className="bg-surface-3 text-accent px-1 py-0.5 rounded text-[12px]" {...props}>
              {children}
            </code>
          ) : (
            <code className={`block bg-surface-3 rounded-md p-3 text-[12px] overflow-x-auto mb-2 ${className ?? ''}`} {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => <pre className="mb-2">{children}</pre>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            {children}
          </a>
        ),
        h1: ({ children }) => <h1 className="text-fg font-semibold text-base mb-1">{children}</h1>,
        h2: ({ children }) => <h2 className="text-fg font-semibold text-sm mb-1">{children}</h2>,
        h3: ({ children }) => <h3 className="text-fg font-semibold text-[13px] mb-1">{children}</h3>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-line pl-3 text-fg-3 mb-2">{children}</blockquote>
        ),
        hr: () => <hr className="border-line my-3" />,
        table: ({ children }) => (
          <div className="overflow-x-auto mb-2">
            <table className="min-w-full text-[12px]">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="text-left px-2 py-1 border-b border-line text-fg-3 font-medium">{children}</th>,
        td: ({ children }) => <td className="px-2 py-1 border-b border-wire-2">{children}</td>,
      }}
    >
      {content}
    </Markdown>
  );
}
