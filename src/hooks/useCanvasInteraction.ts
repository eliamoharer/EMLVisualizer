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
  const pinchState = useRef<{ distance: number; midpointX: number; midpointY: number } | null>(null)
  const touchTargetNodeId = useRef<string | null>(null)
  const didDrag = useRef(false)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

  const handlers = useMemo(
    () => {
      const getWorldPoint = (
        canvas: HTMLCanvasElement,
        clientX: number,
        clientY: number,
        activeCamera: CameraState,
      ) => {
        const rect = canvas.getBoundingClientRect()
        const width = canvas.clientWidth || canvas.width
        const height = canvas.clientHeight || canvas.height
        return screenToWorld(
          clientX - rect.left,
          clientY - rect.top,
          activeCamera,
          width,
          height,
        )
      }

      const findHoveredNode = (
        canvas: HTMLCanvasElement,
        clientX: number,
        clientY: number,
        activeCamera: CameraState,
      ) => {
        const [wx, wy] = getWorldPoint(canvas, clientX, clientY, activeCamera)
        return (
          nodes.find(
            (node) =>
              Math.hypot(node.x - wx, node.y - wy) <=
              Math.max(node.radius * 1.25, 14 / activeCamera.zoom),
          ) ?? null
        )
      }

      const touchDistance = (
        a: { clientX: number; clientY: number },
        b: { clientX: number; clientY: number },
      ) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)

      const touchMidpoint = (
        a: { clientX: number; clientY: number },
        b: { clientX: number; clientY: number },
      ) => ({
        x: (a.clientX + b.clientX) / 2,
        y: (a.clientY + b.clientY) / 2,
      })

      return {
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
        const hovered = findHoveredNode(
          canvas,
          event.clientX,
          event.clientY,
          camera,
        )
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
      onTouchStart: (event: React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = event.currentTarget
        setHoveredNodeId(null)

        if (event.touches.length === 1) {
          const touch = event.touches[0]
          dragStart.current = { x: touch.clientX, y: touch.clientY }
          pinchState.current = null
          didDrag.current = false
          touchTargetNodeId.current =
            findHoveredNode(canvas, touch.clientX, touch.clientY, camera)?.id ?? null
          return
        }

        if (event.touches.length >= 2) {
          const [a, b] = [event.touches[0], event.touches[1]]
          const midpoint = touchMidpoint(a, b)
          pinchState.current = {
            distance: touchDistance(a, b),
            midpointX: midpoint.x,
            midpointY: midpoint.y,
          }
          dragStart.current = null
          touchTargetNodeId.current = null
          didDrag.current = true
        }
      },
      onTouchMove: (event: React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = event.currentTarget
        event.preventDefault()

        if (event.touches.length === 1 && dragStart.current) {
          const touch = event.touches[0]
          const dx = touch.clientX - dragStart.current.x
          const dy = touch.clientY - dragStart.current.y
          if (Math.abs(dx) + Math.abs(dy) > 3) didDrag.current = true
          setCamera((c) => ({
            ...c,
            x: c.x - dx / c.zoom,
            y: c.y - dy / c.zoom,
          }))
          dragStart.current = { x: touch.clientX, y: touch.clientY }
          return
        }

        if (event.touches.length >= 2) {
          const [a, b] = [event.touches[0], event.touches[1]]
          const midpoint = touchMidpoint(a, b)
          const distance = touchDistance(a, b)
          const previous = pinchState.current ?? {
            distance,
            midpointX: midpoint.x,
            midpointY: midpoint.y,
          }
          pinchState.current = {
            distance,
            midpointX: midpoint.x,
            midpointY: midpoint.y,
          }
          didDrag.current = true

          setCamera((c) => {
            const width = canvas.clientWidth || canvas.width
            const height = canvas.clientHeight || canvas.height
            const rect = canvas.getBoundingClientRect()
            const prevMidX = previous.midpointX - rect.left
            const prevMidY = previous.midpointY - rect.top
            const nextMidX = midpoint.x - rect.left
            const nextMidY = midpoint.y - rect.top
            const nextZoom = Math.min(
              Math.max(c.zoom * (distance / Math.max(previous.distance, 1)), 0.15),
              4,
            )
            const [anchorWorldX, anchorWorldY] = screenToWorld(
              prevMidX,
              prevMidY,
              c,
              width,
              height,
            )

            return {
              zoom: nextZoom,
              x: anchorWorldX - (nextMidX - width / 2) / nextZoom,
              y: anchorWorldY - (nextMidY - height / 2) / nextZoom,
            }
          })
        }
      },
      onTouchEnd: () => {
        if (!didDrag.current && touchTargetNodeId.current) {
          onNodeClick(touchTargetNodeId.current)
        }

        dragStart.current = null
        pinchState.current = null
        touchTargetNodeId.current = null
      },
      onTouchCancel: () => {
        dragStart.current = null
        pinchState.current = null
        touchTargetNodeId.current = null
      },
    }
    },
    [camera, hoveredNodeId, nodes, onNodeClick, setCamera],
  )

  return { handlers, hoveredNodeId }
}
