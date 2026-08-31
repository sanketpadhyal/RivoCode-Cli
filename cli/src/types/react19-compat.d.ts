import 'react'

declare module 'react' {
  interface FunctionComponent<P = {}> {
    (props: P): ReactNode
  }
}

declare module 'react-dom/server' {
  export function renderToStaticMarkup(element: React.ReactElement): string
  export function renderToString(element: React.ReactElement): string
}
