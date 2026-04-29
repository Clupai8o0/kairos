'use client';

import { isTextUIPart, isStaticToolUIPart, isFileUIPart, type UIMessage, type FileUIPart } from 'ai';
import { AnimatePresence, motion } from 'framer-motion';
import { ToolCallBlock } from './tool-call-block';
import { ChatMarkdown } from './chat-markdown';

interface TranscriptProps {
  messages: UIMessage[];
  onApprovalResponse?: (approvalId: string, approved: boolean) => void;
}

function AttachmentChip({ part }: { part: FileUIPart }) {
  const { mediaType, filename, url } = part;

  if (mediaType.startsWith('image/')) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block rounded overflow-hidden max-w-[240px]">
        <img src={url} alt={filename ?? 'image'} className="max-h-48 w-full object-contain bg-surface-3 rounded" />
      </a>
    );
  }

  const isPdf = mediaType === 'application/pdf';
  const icon = isPdf ? (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );

  return (
    <a
      href={url}
      download={filename}
      className="inline-flex items-center gap-1.5 bg-brand/10 border border-brand/20 text-fg-2 rounded px-2 py-1 text-[11px] hover:bg-brand/15 transition-colors max-w-[200px]"
    >
      <span className="text-fg-3 shrink-0">{icon}</span>
      <span className="truncate">{filename ?? 'file'}</span>
    </a>
  );
}

export function Transcript({ messages, onApprovalResponse }: TranscriptProps) {
  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-fg-4 text-[13px]">
          Ask Kairos to create tasks, check your schedule, or manage tags.
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 py-4 space-y-4">
      <AnimatePresence initial={false}>
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {message.role === 'user' ? (
              <div className="flex justify-end">
                <div className="max-w-[75%] flex flex-col items-end gap-1.5">
                  {/* File attachments */}
                  {message.parts.filter(isFileUIPart).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {message.parts.filter(isFileUIPart).map((part, i) => (
                        <AttachmentChip key={i} part={part} />
                      ))}
                    </div>
                  )}
                  {/* Text */}
                  {message.parts.filter(isTextUIPart).some((p) => p.text.trim()) && (
                    <div className="rounded-md px-3 py-2 bg-brand/10 text-fg text-[13px] leading-relaxed whitespace-pre-wrap">
                      {message.parts.filter(isTextUIPart).map((p, i) => (
                        <span key={i}>{p.text}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-w-[85%]">
                {/* Tool invocations */}
                {message.parts.filter(isStaticToolUIPart).map((part) => (
                  <ToolCallBlock
                    key={part.toolCallId}
                    toolPart={part}
                    onApprovalResponse={onApprovalResponse}
                  />
                ))}
                {/* Text content */}
                {message.parts.filter(isTextUIPart).map((part, i) => (
                  part.text && (
                    <div key={i} className="text-fg-2 text-[13px] leading-relaxed">
                      <ChatMarkdown content={part.text} />
                    </div>
                  )
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
