import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'

interface SearchableItem {
  id: string
  label: string
}

export interface UseSearchableListOptions<T extends SearchableItem> {
  items: T[]
  resetKey?: string
  filterFn?: (item: T, query: string) => boolean
}

export interface UseSearchableListReturn<T extends SearchableItem> {
  searchQuery: string
  setSearchQuery: (query: string) => void
  focusedIndex: number
  setFocusedIndex: Dispatch<SetStateAction<number>>
  filteredItems: T[]
  handleFocusChange: (index: number) => void
}

export function useSearchableList<T extends SearchableItem>({
  items,
  resetKey,
  filterFn,
}: UseSearchableListOptions<T>): UseSearchableListReturn<T> {
  const [searchQuery, setSearchQuery] = useState('')
  const [focusedIndex, setFocusedIndex] = useState(0)

  const defaultFilterFn = useCallback(
    (item: T, query: string) =>
      item.label.toLowerCase().includes(query.toLowerCase()),
    [],
  )

  const filterFunction = filterFn ?? defaultFilterFn

  const filteredItems = useMemo(() => {
    const trimmedQuery = searchQuery.trim()
    if (!trimmedQuery) return items
    if (trimmedQuery.startsWith('/') || trimmedQuery.startsWith('~')) return items
    return items.filter((item) =>
      item.label === '..' || filterFunction(item, trimmedQuery)
    )
  }, [items, searchQuery, filterFunction])

  useEffect(() => {
    setFocusedIndex(0)
  }, [resetKey])

  useEffect(() => {
    if (focusedIndex >= filteredItems.length) {
      setFocusedIndex(Math.max(0, filteredItems.length - 1))
    }
  }, [filteredItems.length, focusedIndex])

  const handleFocusChange = useCallback((index: number) => {
    setFocusedIndex(index)
  }, [])

  return {
    searchQuery,
    setSearchQuery,
    focusedIndex,
    setFocusedIndex,
    filteredItems,
    handleFocusChange,
  }
}
