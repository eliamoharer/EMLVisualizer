import katex from 'katex'

interface MathTextProps {
  expression: string
  display?: boolean
  fallbackLabel?: string
}

export function MathText({
  expression,
  display = false,
  fallbackLabel,
}: MathTextProps) {
  let html: string | null = null
  try {
    html = katex.renderToString(expression, {
      throwOnError: true,
      displayMode: display,
    })
  } catch {
    html = null
  }
  if (html === null) {
    return (
      <span className="math-text math-text-fallback">
        {fallbackLabel ?? `Could not render: ${expression}`}
      </span>
    )
  }
  return <span className="math-text" dangerouslySetInnerHTML={{ __html: html }} />
}
