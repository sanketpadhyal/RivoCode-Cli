import {
  finetunedVertexModelNames,
  costModes,
  type CostMode,
} from '@rivocode/common/old-constants'
import { z } from 'zod/v4'

const customFileCountsShape = costModes.reduce(
  (acc, mode) => {
    acc[mode] = z.number().int().positive().optional()
    return acc
  },
  {} as Record<CostMode, z.ZodOptional<z.ZodNumber>>,
)

const modelNameEnumValues = Object.values(finetunedVertexModelNames)

if (
  !Array.isArray(modelNameEnumValues) ||
  modelNameEnumValues.length === 0 ||
  !modelNameEnumValues.every((val) => typeof val === 'string' && val.length > 0)
) {
  let problemDescription = 'Unknown issue.'
  if (!Array.isArray(modelNameEnumValues)) problemDescription = 'Not an array.'
  else if (modelNameEnumValues.length === 0)
    problemDescription = 'Array is empty.'
  else problemDescription = 'Array contains non-string or empty string values.'

  throw new Error(
    `CustomFilePickerConfigSchema: No valid string values found for modelName enum. Problem: ${problemDescription}. Values from finetunedVertexModelNames: ${JSON.stringify(modelNameEnumValues)}`,
  )
}

export const CustomFilePickerConfigSchema = z.object({
  modelName: z.enum(modelNameEnumValues as [string, ...string[]]),

  maxFilesPerRequest: z.number().int().positive().optional(),

  customFileCounts: z.object(customFileCountsShape).optional(),
})

export type CustomFilePickerConfig = z.infer<
  typeof CustomFilePickerConfigSchema
>
