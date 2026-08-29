import { describe, test, expect } from 'bun:test'
import React, { useCallback } from 'react'
import { renderToString } from 'react-dom/server'

import { GridLayout } from '../grid-layout'

interface TestItem {
  id: string
  name: string
}

const createTestItem = (id: string, name: string): TestItem => ({ id, name })

interface RenderTracker {
  renderedItems: Map<number, string[]>
  renderCounts: Map<string, number>
}

function createRenderTracker(): RenderTracker {
  return {
    renderedItems: new Map(),
    renderCounts: new Map(),
  }
}

function TrackedGridLayout({
  items,
  availableWidth,
  tracker,
}: {
  items: TestItem[]
  availableWidth: number
  tracker: RenderTracker
}) {
  const renderItem = useCallback(
    (item: TestItem, _idx: number, _columnWidth: number) => {
      const currentCount = tracker.renderCounts.get(item.id) || 0
      tracker.renderCounts.set(item.id, currentCount + 1)

      const widthItems = tracker.renderedItems.get(availableWidth) || []
      if (!widthItems.includes(item.name)) {
        widthItems.push(item.name)
        tracker.renderedItems.set(availableWidth, widthItems)
      }

      return <text key={item.id}>{item.name}</text>
    },
    [availableWidth, tracker],
  )

  const getItemKey = useCallback((item: TestItem) => item.id, [])

  return (
    <GridLayout
      items={items}
      availableWidth={availableWidth}
      getItemKey={getItemKey}
      renderItem={renderItem}
    />
  )
}

describe('GridLayout React Reconciliation', () => {
  describe('column transition (2→1) reconciliation', () => {
    test('all items survive rerender when width changes from 120 to 80', () => {
      const items = [
        createTestItem('a', 'Alpha'),
        createTestItem('b', 'Beta'),
        createTestItem('c', 'Gamma'),
      ]
      const tracker = createRenderTracker()

      const markup1 = renderToString(
        <TrackedGridLayout items={items} availableWidth={120} tracker={tracker} />,
      )

      expect(tracker.renderedItems.get(120)?.sort()).toEqual(['Alpha', 'Beta', 'Gamma'])
      expect(markup1).toContain('Alpha')
      expect(markup1).toContain('Beta')
      expect(markup1).toContain('Gamma')

      const markup2 = renderToString(
        <TrackedGridLayout items={items} availableWidth={80} tracker={tracker} />,
      )

      expect(tracker.renderedItems.get(80)?.sort()).toEqual(['Alpha', 'Beta', 'Gamma'])
      expect(markup2).toContain('Alpha')
      expect(markup2).toContain('Beta')
      expect(markup2).toContain('Gamma')

      expect(tracker.renderCounts.get('a')).toBe(2)
      expect(tracker.renderCounts.get('b')).toBe(2)
      expect(tracker.renderCounts.get('c')).toBe(2)
    })

    test('item order is preserved after 2→1 transition', () => {
      const items = [
        createTestItem('1', 'First'),
        createTestItem('2', 'Second'),
        createTestItem('3', 'Third'),
        createTestItem('4', 'Fourth'),
      ]
      const tracker = createRenderTracker()

      renderToString(
        <TrackedGridLayout items={items} availableWidth={120} tracker={tracker} />,
      )

      const markup = renderToString(
        <TrackedGridLayout items={items} availableWidth={80} tracker={tracker} />,
      )

      const firstPos = markup.indexOf('First')
      const secondPos = markup.indexOf('Second')
      const thirdPos = markup.indexOf('Third')
      const fourthPos = markup.indexOf('Fourth')

      expect(firstPos).toBeLessThan(secondPos)
      expect(secondPos).toBeLessThan(thirdPos)
      expect(thirdPos).toBeLessThan(fourthPos)
    })

    test('multiple rapid width changes preserve all items', () => {
      const items = [
        createTestItem('a', 'Apple'),
        createTestItem('b', 'Banana'),
        createTestItem('c', 'Cherry'),
      ]
      const tracker = createRenderTracker()

      const widthSequence = [120, 80, 120, 80, 120]

      for (const width of widthSequence) {
        const markup = renderToString(
          <TrackedGridLayout items={items} availableWidth={width} tracker={tracker} />,
        )

        expect(markup).toContain('Apple')
        expect(markup).toContain('Banana')
        expect(markup).toContain('Cherry')
      }

      expect(tracker.renderCounts.get('a')).toBe(5)
      expect(tracker.renderCounts.get('b')).toBe(5)
      expect(tracker.renderCounts.get('c')).toBe(5)
    })

    test('3→2→1 column transition preserves all items', () => {
      const items = [
        createTestItem('a', 'One'),
        createTestItem('b', 'Two'),
        createTestItem('c', 'Three'),
        createTestItem('d', 'Four'),
        createTestItem('e', 'Five'),
        createTestItem('f', 'Six'),
      ]
      const tracker = createRenderTracker()

      renderToString(
        <TrackedGridLayout items={items} availableWidth={180} tracker={tracker} />,
      )
      expect(tracker.renderedItems.get(180)?.length).toBe(6)

      renderToString(
        <TrackedGridLayout items={items} availableWidth={120} tracker={tracker} />,
      )
      expect(tracker.renderedItems.get(120)?.length).toBe(6)

      const finalMarkup = renderToString(
        <TrackedGridLayout items={items} availableWidth={80} tracker={tracker} />,
      )
      expect(tracker.renderedItems.get(80)?.length).toBe(6)

      expect(finalMarkup).toContain('One')
      expect(finalMarkup).toContain('Two')
      expect(finalMarkup).toContain('Three')
      expect(finalMarkup).toContain('Four')
      expect(finalMarkup).toContain('Five')
      expect(finalMarkup).toContain('Six')
    })

    test('1→2 column expansion also works correctly', () => {
      const items = [
        createTestItem('x', 'Xray'),
        createTestItem('y', 'Yankee'),
        createTestItem('z', 'Zulu'),
      ]
      const tracker = createRenderTracker()

      renderToString(
        <TrackedGridLayout items={items} availableWidth={80} tracker={tracker} />,
      )
      expect(tracker.renderedItems.get(80)?.sort()).toEqual(['Xray', 'Yankee', 'Zulu'])

      const expandedMarkup = renderToString(
        <TrackedGridLayout items={items} availableWidth={120} tracker={tracker} />,
      )
      expect(tracker.renderedItems.get(120)?.sort()).toEqual(['Xray', 'Yankee', 'Zulu'])

      expect(expandedMarkup).toContain('Xray')
      expect(expandedMarkup).toContain('Yankee')
      expect(expandedMarkup).toContain('Zulu')
    })
  })

  describe('unified DOM structure verification', () => {
    test('both column layouts produce valid markup', () => {
      const items = [
        createTestItem('a', 'Item1'),
        createTestItem('b', 'Item2'),
      ]

      const twoColMarkup = renderToString(
        <GridLayout
          items={items}
          availableWidth={120}
          getItemKey={(item) => item.id}
          renderItem={(item) => <text>{item.name}</text>}
        />,
      )

      const oneColMarkup = renderToString(
        <GridLayout
          items={items}
          availableWidth={80}
          getItemKey={(item) => item.id}
          renderItem={(item) => <text>{item.name}</text>}
        />,
      )

      expect(twoColMarkup.length).toBeGreaterThan(0)
      expect(oneColMarkup.length).toBeGreaterThan(0)

      expect(twoColMarkup).toContain('Item1')
      expect(twoColMarkup).toContain('Item2')
      expect(oneColMarkup).toContain('Item1')
      expect(oneColMarkup).toContain('Item2')
    })

    test('no items lost even with dramatic width reduction', () => {
      const items = Array.from({ length: 10 }, (_, i) =>
        createTestItem(`item-${i}`, `Content${i}`),
      )
      const tracker = createRenderTracker()

      renderToString(
        <TrackedGridLayout items={items} availableWidth={250} tracker={tracker} />,
      )

      const finalMarkup = renderToString(
        <TrackedGridLayout items={items} availableWidth={50} tracker={tracker} />,
      )

      for (let i = 0; i < 10; i++) {
        expect(finalMarkup).toContain(`Content${i}`)
      }
    })
  })
})
