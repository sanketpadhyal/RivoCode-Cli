import z from 'zod/v4'

export const dataContentSchema = z.union([
  z.string(),
  z.instanceof(Uint8Array),
  z.instanceof(ArrayBuffer),
  z.custom<Buffer>(
    (value: unknown): value is Buffer =>
      globalThis.Buffer?.isBuffer(value) ?? false,
    { message: 'Must be a Buffer' },
  ),
])
export type DataContent = z.infer<typeof dataContentSchema>
