import 'react'

declare module 'react' {
  interface FunctionComponent<P = {}> {
    (props: P): ReactNode
  }
}
