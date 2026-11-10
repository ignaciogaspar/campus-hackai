import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Markdown de consignas, entregas y comentarios. No renderiza HTML crudo. */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={`ent-md${className ? ` ${className}` : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ a: ({ href, children: c }) => <a href={href} target="_blank" rel="noreferrer noopener">{c}</a> }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
