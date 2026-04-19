'use client';

import { isTextUIPart, isStaticToolUIPart, type UIMessage } from 'ai';
import { AnimatePresence, motion } from 'framer-motion';
import { ToolCallBlock } from './tool-call-block';
import { ChatMarkdown } from './chat-markdown';

interface TranscriptProps {
  messages: UIMessage[];
  onApprovalResponse?: (approvalId: string, approved: boolean) => void;
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
                <div className="max-w-[75%] rounded-md px-3 py-2 bg-brand/10 text-fg text-[13px] leading-relaxed whitespace-pre-wrap">
                  {message.parts.filter(isTextUIPart).map((p, i) => (
                    <span key={i}>{p.text}</span>
                  ))}
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
