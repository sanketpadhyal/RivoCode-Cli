import z from 'zod/v4'

export function schemaToJsonStr(
  schema: z.ZodTypeAny | undefined | Record<string, any>,
  options?: Parameters<typeof z.toJSONSchema>[1],
): string {
  if (!schema) return 'None'

  try {
    if (schema instanceof z.ZodType) {
      const jsonSchema = z.toJSONSchema(schema, options)
      delete jsonSchema['$schema']
      return JSON.stringify(jsonSchema, null, 2)
    }

    return JSON.stringify(schema, null, 2)
  } catch (error) {
    return 'None'
  }
}
