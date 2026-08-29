import { isKeypadEnter } from './keypad-keys'

type EnterDetectionKey = {
  name?: string
  sequence?: string
  shift?: boolean
  ctrl?: boolean
  meta?: boolean
  option?: boolean
}

const defaultHasSeenReturnKey = process.platform === 'darwin'

let hasSeenReturnKey = defaultHasSeenReturnKey

export function shouldMarkReturnKeySeen(key: EnterDetectionKey): boolean {
  return (key.name === 'return' || key.name === 'enter') && !isKeypadEnter(key)
}

export function isPlainEnterKey(key: EnterDetectionKey): boolean {
  markReturnKeySeenForKey(key)

  return (
    (key.name === 'return' ||
      key.name === 'enter' ||
      isKeypadEnter(key) ||
      (key.name === 'linefeed' && isLinefeedActingAsEnter())) &&
    !key.shift &&
    !key.ctrl &&
    !key.meta &&
    !key.option
  )
}

export function markReturnKeySeen(): void {
  hasSeenReturnKey = true
}

export function markReturnKeySeenForKey(key: EnterDetectionKey): void {
  if (shouldMarkReturnKeySeen(key)) {
    markReturnKeySeen()
  }
}

export function isLinefeedActingAsEnter(): boolean {
  return !hasSeenReturnKey
}

export function resetReturnKeySeenForTests(
  hasSeenReturn: boolean = defaultHasSeenReturnKey,
): void {
  hasSeenReturnKey = hasSeenReturn
}
