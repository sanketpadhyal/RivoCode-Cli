import * as fs from 'fs'
import { randomUUID } from 'node:crypto'

function tempPathFor(filePath: string): string {
  return `${filePath}.${process.pid}.${randomUUID()}.tmp`
}

export function writeFileAtomic(filePath: string, data: string): void {
  const tmpPath = tempPathFor(filePath)
  try {
    fs.writeFileSync(tmpPath, data)
    fs.renameSync(tmpPath, filePath)
  } catch (error) {
    try {
      fs.unlinkSync(tmpPath)
    } catch {
    }
    throw error
  }
}

export async function writeFileAtomicAsync(
  filePath: string,
  data: string,
): Promise<void> {
  const tmpPath = tempPathFor(filePath)
  try {
    await fs.promises.writeFile(tmpPath, data)
    await fs.promises.rename(tmpPath, filePath)
  } catch (error) {
    try {
      await fs.promises.unlink(tmpPath)
    } catch {
    }
    throw error
  }
}
