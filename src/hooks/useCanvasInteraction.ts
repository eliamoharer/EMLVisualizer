import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { PositionedNode } from '../core/eml/types'
import type { CameraState } from '../render/camera'
import { screenToWorld } from '../render/camera'

export function useCanvasInteraction(
  camera: CameraState,
  setCamera: Dispatch<SetStateAction<CameraState>>,
  nodes: PositionedNode[],
  onNodeClick: (nodeId: string) => void,
) {
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const didDrag = useRef(false)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

  const handlers = useMemo(
    () => ({
      onMouseDown: (event: React.MouseEvent<HTMLCanvasElement>) => {
        dragStart.current = { x: event.clientX, y: event.clientY }
        didDrag.current = false
      },
      onMouseUp: () => {
        if (!didDrag.current && hoveredNodeId) {
          onNodeClick(hoveredNodeId)
        }
        dragStart.current = null
      },
      onMouseLeave: () => {
        dragStart.current = null
        setHoveredNodeId(null)
      },
      onMouseMove: (event: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = event.currentTarget
        const rect = canvas.getBoundingClientRect()
        const width = canvas.clientWidth || canvas.width
        const height = canvas.clientHeight || canvas.height
        const [wx, wy] = screenToWorld(
          event.clientX - rect.left,
          event.clientY - rect.top,
          camera,
          width,
          height,
        )

        const hovered =
          nodes.find(
            (node) =>
              Math.hypot(node.x - wx, node.y - wy) <=
              Math.max(node.radius * 1.25, 14 / camera.zoom),
          ) ?? null
        setHoveredNodeId(hovered?.id ?? null)

        if (!dragStart.current) return
        const dx = event.clientX - dragStart.current.x
        const dy = event.clientY - dragStart.current.y
        if (Math.abs(dx) + Math.abs(dy) > 3) didDrag.current = true
        setCamera((c) => ({
          ...c,
          x: c.x - dx / c.zoom,
          y: c.y - dy / c.zoom,
        }))
        dragStart.current = { x: event.clientX, y: event.clientY }
      },
      onWheel: (event: React.WheelEvent<HTMLCanvasElement>) => {
        event.preventDefault()
        const scale = event.deltaY > 0 ? 0.92 : 1.09
        setCamera((c) => ({
          ...c,
          zoom: Math.min(Math.max(c.zoom * scale, 0.15), 4),
        }))
      },
    }),
    [camera, hoveredNodeId, nodes, onNodeClick, setCamera],
  )

  return { handlers, hoveredNodeId }
}
