import React, { cloneElement, isValidElement, memo } from 'react'

import type { ReactElement, ReactNode } from 'react'

export function makeTextUnselectable(node: ReactNode): ReactNode {
  if (node === null || node === undefined || typeof node === 'boolean') return node
  if (typeof node === 'string' || typeof node === 'number') return node

  if (Array.isArray(node)) {
    return node.map((child, idx) => <React.Fragment key={idx}>{makeTextUnselectable(child)}</React.Fragment>)
  }

  if (!isValidElement(node)) return node

  const el = node as ReactElement<{ children?: ReactNode; [key: string]: unknown }>
  const type = el.type

  if (typeof type === 'string' && (type === 'text' || type === 'span')) {
    const nextProps = { ...el.props, selectable: false }
    const nextChildren = el.props.children ? makeTextUnselectable(el.props.children) : el.props.children
    return cloneElement(el, nextProps, nextChildren)
  }

  const nextChildren = el.props.children ? makeTextUnselectable(el.props.children) : el.props.children
  return cloneElement(el, el.props, nextChildren)
}

interface ClickableProps {
  as?: 'box' | 'text'
  onMouseDown?: (e?: unknown) => void
  onMouseUp?: (e?: unknown) => void
  onMouseOver?: () => void
  onMouseOut?: () => void
  style?: Record<string, unknown>
  children?: ReactNode
  [key: string]: unknown
}

export const Clickable = memo(function Clickable({
  as = 'box',
  onMouseDown,
  onMouseUp,
  onMouseOver,
  onMouseOut,
  style,
  children,
  ...rest
}: ClickableProps) {
  const sharedProps = {
    ...rest,
    style,
    onMouseDown,
    onMouseUp,
    onMouseOver,
    onMouseOut,
  }

  if (as === 'text') {
    return (
      <text {...sharedProps} selectable={false}>
        {children}
      </text>
    )
  }

  const processedChildren = makeTextUnselectable(children)
  return <box {...sharedProps}>{processedChildren}</box>
})
