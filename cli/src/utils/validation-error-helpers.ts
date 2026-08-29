
export const NETWORK_ERROR_ID = 'network_error'

export function filterNetworkErrors(
  errors: Array<{ id: string; message: string }>,
): Array<{ id: string; message: string }> {
  return errors.filter((error) => error.id !== NETWORK_ERROR_ID)
}
