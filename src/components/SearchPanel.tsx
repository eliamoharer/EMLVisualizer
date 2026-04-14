import type { SearchEntry } from '../core/search/indexer'

interface SearchPanelProps {
  query: string
  results: SearchEntry[]
  createError: string | null
  onQueryChange: (value: string) => void
  onSelectNode: (id: string) => void
  onCreateNode: () => void
}

export function SearchPanel({
  query,
  results,
  createError,
  onQueryChange,
  onSelectNode,
  onCreateNode,
}: SearchPanelProps) {
  return (
    <aside className="panel search-panel">
      <h2>Trace Or Create</h2>
      <div className="search-input-wrap">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (results[0]) onSelectNode(results[0].id)
              else if (query.trim()) onCreateNode()
            }
          }}
          placeholder="Search or type a function like 2x+y"
        />
        {query ? (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => onQueryChange('')}
            aria-label="Clear trace or create input"
          >
            ×
          </button>
        ) : null}
      </div>
      <div className="search-actions">
        <button
          type="button"
          className="create-node-btn"
          onClick={onCreateNode}
          disabled={!query.trim()}
        >
          Create Node
        </button>
      </div>
      {results.length > 0 ? (
        <ul>
          {results.map((entry) => (
            <li key={entry.id}>
              <button type="button" onClick={() => onSelectNode(entry.id)}>
                {entry.label}
              </button>
            </li>
          ))}
        </ul>
      ) : query ? (
        <p className="hint">No built-in match yet. You can still create a custom node.</p>
      ) : null}
      {createError ? <p className="error-hint">{createError}</p> : null}
    </aside>
  )
}
