import { getProjectRoot } from '../project-files'
import { validateAndAddImage } from '../utils/pending-attachments'

export async function handleImageCommand(args: string): Promise<string> {
  const [imagePath, ...rest] = args.trim().split(/\s+/)

  if (imagePath) {
    await validateAndAddImage(imagePath, getProjectRoot())
  }

  return rest.join(' ')
}
