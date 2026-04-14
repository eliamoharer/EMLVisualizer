import type { Family } from '../core/eml/types'
import { TOGGLEABLE_FAMILIES } from '../core/eml/types'
import { FAMILY_META } from '../core/eml/families'

interface ControlPanelProps {
  depth: number
  onDepthChange: (depth: number) => void
  familyEnabled: Record<Family, boolean>
  onToggleFamily: (family: Family) => void
}

export function ControlPanel({
  depth,
  onDepthChange,
  familyEnabled,
  onToggleFamily,
}: ControlPanelProps) {
  return (
    <aside className="panel control-panel">
      <h2>Derivation Depth</h2>
      <label className="depth-label">
        <span className="depth-value">{depth}</span>
        <input
          type="range"
          min={1}
          max={8}
          value={depth}
          onChange={(e) => onDepthChange(Number(e.target.value))}
        />
      </label>
      <h2>Families</h2>
      <div className="family-grid">
        {TOGGLEABLE_FAMILIES.map((family) => {
          const meta = FAMILY_META[family]
          return (
            <label key={family} className="toggle-line">
              <span
                className="color-dot"
                style={{ background: meta.color }}
              />
              <input
                type="checkbox"
                checked={familyEnabled[family]}
                onChange={() => onToggleFamily(family)}
              />
              {meta.label}
            </label>
          )
        })}
      </div>
    </aside>
  )
}
