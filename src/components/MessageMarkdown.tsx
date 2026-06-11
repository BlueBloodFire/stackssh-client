import { useState, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ThemeColors } from '../stores/themeStore'

/**
 * Codex 风格的消息 Markdown 渲染器
 * - 代码块：带语言标签头 + 复制按钮
 * - 完整支持标题/列表/表格/引用/分隔线（GFM）
 * - 无气泡，直接渲染在面板背景上
 */

function CodeBlock({ language, code, colors }: { language: string; code: string; colors: ThemeColors }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }

  return (
    <div
      className="my-2 rounded-lg overflow-hidden border"
      style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}
    >
      <div
        className="flex items-center justify-between px-3 h-7 border-b"
        style={{ borderColor: colors.border, backgroundColor: colors.bgTertiary }}
      >
        <span className="text-[10px] font-mono uppercase tracking-wide" style={{ color: colors.textDim }}>
          {language || 'text'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors hover:bg-black/5"
          style={{ color: copied ? colors.green : colors.textDim }}
        >
          {copied ? (
            <>
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              已复制
            </>
          ) : (
            <>
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              复制
            </>
          )}
        </button>
      </div>
      <pre
        className="px-3 py-2.5 overflow-x-auto text-[12px] leading-[1.6]"
        style={{ fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace", color: colors.text, margin: 0 }}
      >
        <code>{code}</code>
      </pre>
    </div>
  )
}

interface MessageMarkdownProps {
  content: string
  colors: ThemeColors
}

export const MessageMarkdown = memo(function MessageMarkdown({ content, colors }: MessageMarkdownProps) {
  return (
    <div className="message-markdown text-[13px] leading-[1.7]" style={{ color: colors.text, wordBreak: 'break-word' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p style={{ margin: '0 0 8px 0' }}>{children}</p>,
          h1: ({ children }) => <h1 className="text-[16px] font-semibold" style={{ margin: '14px 0 6px', color: colors.text }}>{children}</h1>,
          h2: ({ children }) => <h2 className="text-[15px] font-semibold" style={{ margin: '12px 0 6px', color: colors.text }}>{children}</h2>,
          h3: ({ children }) => <h3 className="text-[14px] font-semibold" style={{ margin: '10px 0 4px', color: colors.text }}>{children}</h3>,
          h4: ({ children }) => <h4 className="text-[13px] font-semibold" style={{ margin: '8px 0 4px', color: colors.text }}>{children}</h4>,
          ul: ({ children }) => <ul style={{ margin: '4px 0 8px', paddingLeft: 20, listStyleType: 'disc' }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ margin: '4px 0 8px', paddingLeft: 20, listStyleType: 'decimal' }}>{children}</ol>,
          li: ({ children }) => <li style={{ margin: '2px 0' }}>{children}</li>,
          blockquote: ({ children }) => (
            <blockquote
              style={{
                borderLeft: `3px solid ${colors.accent}`,
                margin: '6px 0',
                padding: '4px 10px',
                color: colors.textSecondary,
                backgroundColor: colors.bgSecondary,
                borderRadius: '0 6px 6px 0',
              }}
            >
              {children}
            </blockquote>
          ),
          hr: () => <hr style={{ border: 'none', borderTop: `1px solid ${colors.border}`, margin: '12px 0' }} />,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" style={{ color: colors.accent, textDecoration: 'underline' }}>
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2 rounded-lg border" style={{ borderColor: colors.border }}>
              <table className="w-full text-[12px]" style={{ borderCollapse: 'collapse' }}>{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th
              className="px-3 py-1.5 text-left font-medium"
              style={{ backgroundColor: colors.bgSecondary, borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-1.5" style={{ borderBottom: `1px solid ${colors.border}` }}>{children}</td>
          ),
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '')
            const codeText = String(children).replace(/\n$/, '')
            // 多行或带语言标记 → 代码块；否则行内代码
            const isBlock = match || codeText.includes('\n')
            if (isBlock) {
              return <CodeBlock language={match?.[1] ?? ''} code={codeText} colors={colors} />
            }
            return (
              <code
                className="px-1.5 py-0.5 rounded text-[12px]"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  backgroundColor: colors.bgTertiary,
                  color: colors.accent,
                  border: `1px solid ${colors.border}`,
                }}
                {...props}
              >
                {children}
              </code>
            )
          },
          // pre 由 code 组件接管，避免双层包裹
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})
