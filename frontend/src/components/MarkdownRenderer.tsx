"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  if (!content) return null;

  return (
    <div className={`report-markdown font-sans leading-relaxed text-brown-light ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-brown mt-8 mb-4 tracking-tight border-b border-brown/10 pb-3" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="font-serif text-2xl md:text-3xl font-semibold text-brown mt-8 mb-3 tracking-tight border-b border-brown/5 pb-2" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="font-serif text-xl md:text-2xl font-semibold text-brown mt-6 mb-2" {...props} />
          ),
          h4: ({ node, ...props }) => (
            <h4 className="font-serif text-lg font-semibold text-brown mt-4 mb-2" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="text-base leading-relaxed text-brown-light mb-4" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-outside pl-6 space-y-2 mb-4 text-brown-light" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal list-outside pl-6 space-y-2 mb-4 text-brown-light" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="leading-relaxed" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-brand bg-brand/5 px-5 py-3.5 my-5 rounded-r-xl italic text-brown-light shadow-sm" {...props} />
          ),
          hr: ({ node, ...props }) => (
            <hr className="my-8 border-t border-brown/10" {...props} />
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-6 rounded-xl border border-brown/10 shadow-sm bg-white">
              <table className="w-full text-left text-sm border-collapse" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-cream-dark border-b border-brown/10 text-brown font-serif font-bold text-xs uppercase tracking-wider" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="p-3.5 font-bold" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="p-3.5 border-t border-brown/5 text-brown-light align-top" {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong className="font-bold text-brown" {...props} />
          ),
          em: ({ node, ...props }) => (
            <em className="italic" {...props} />
          ),
          code: ({ node, className, children, ...props }) => {
            const isInline = !className && typeof children === "string" && !children.includes("\n");
            return isInline ? (
              <code className="bg-brown/5 text-brand font-mono text-xs px-1.5 py-0.5 rounded border border-brown/10" {...props}>
                {children}
              </code>
            ) : (
              <pre className="bg-brown text-cream p-4 rounded-xl overflow-x-auto my-4 text-xs font-mono">
                <code {...props}>{children}</code>
              </pre>
            );
          },
          a: ({ node, ...props }) => (
            <a
              className="text-brand font-medium hover:text-brand-light underline underline-offset-2 transition-colors inline-flex items-center gap-1"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
