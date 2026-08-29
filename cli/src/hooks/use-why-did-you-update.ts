import { useEffect, useRef } from 'react'

import { getCliEnv } from '../utils/env'
import { logger } from '../utils/logger'

export function useWhyDidYouUpdate<T extends Record<string, any>>(
  componentName: string,
  props: T,
  options: {
    logLevel?: 'debug' | 'info' | 'warn' | 'error'
    enabled?: boolean
  } = {},
): void {
  const env = getCliEnv()
  const {
    logLevel = 'info',
    enabled = env.NODE_ENV === 'development',
  } = options

  const previousProps = useRef<T | null>(null)
  const renderCount = useRef(0)

  useEffect(() => {
    if (!enabled) return

    renderCount.current += 1

    if (previousProps.current) {
      const propKeys = Object.keys(props) as (keyof T)[]
      const changedProps = propKeys.filter(
        (key) => previousProps.current![key] !== props[key],
      )

      if (changedProps.length > 0) {
        const logData = {
          renderCount: renderCount.current,
          changedProps: changedProps.map((key) => String(key)),
          propChanges: changedProps.reduce(
            (acc, key) => {
              acc[String(key)] = {
                previous: previousProps.current![key],
                current: props[key],
              }
              return acc
            },
            {} as Record<string, { previous: any; current: any }>,
          ),
        }

        logger[logLevel](
          logData,
          `${componentName} render #${renderCount.current}: ${changedProps.length} ${changedProps.length === 1 ? 'prop' : 'props'} changed`,
        )
      } else {
        logger[logLevel](
          { renderCount: renderCount.current },
          `${componentName} render #${renderCount.current}: No props changed (possible internal state or context change)`,
        )
      }
    } else {
      logger[logLevel](
        { renderCount: renderCount.current },
        `${componentName} initial render`,
      )
    }

    previousProps.current = props
  })
}

export function useWhyDidYouUpdateById<T extends Record<string, any>>(
  componentName: string,
  id: string,
  props: T,
  options: {
    logLevel?: 'debug' | 'info' | 'warn' | 'error'
    enabled?: boolean
  } = {},
): void {
  const env = getCliEnv()
  const { logLevel = 'info', enabled = env.NODE_ENV === 'development' } =
    options

  const previousProps = useRef<T | null>(null)
  const renderCountById = useRef<Record<string, number>>({})

  useEffect(() => {
    if (!enabled) return

    renderCountById.current[id] = (renderCountById.current[id] || 0) + 1
    const renderCount = renderCountById.current[id]

    if (previousProps.current) {
      const propKeys = Object.keys(props) as (keyof T)[]
      const changedProps = propKeys.filter(
        (key) => previousProps.current![key] !== props[key],
      )

      const logData = {
        id,
        renderCount,
        changedProps: changedProps.map((key) => String(key)),
      }

      if (changedProps.length > 0) {
        logger[logLevel](
          {
            ...logData,
            propChanges: changedProps.reduce(
              (acc, key) => {
                acc[String(key)] = {
                  previous: previousProps.current![key],
                  current: props[key],
                }
                return acc
              },
              {} as Record<string, { previous: any; current: any }>,
            ),
          },
          `${componentName} render #${renderCount} [${id}]: ${changedProps.length} ${changedProps.length === 1 ? 'prop' : 'props'} changed`,
        )
      } else {
        logger[logLevel](
          logData,
          `${componentName} render #${renderCount} [${id}]: No props changed`,
        )
      }
    } else {
      logger[logLevel](
        { id, renderCount },
        `${componentName}[${id}] initial render`,
      )
    }

    previousProps.current = props
  })
}
