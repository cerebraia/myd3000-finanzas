export type FileCategory = 'image' | 'document' | 'design'

const ALLOWED_MIME: Record<FileCategory, string[]> = {
  image: [
    'image/jpeg',
    'image/png',
    'image/webp',
  ],
  document: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  design: [
    'application/pdf',
  ],
}

const MAX_BYTES: Record<FileCategory, number> = {
  image:    10 * 1024 * 1024,
  document: 20 * 1024 * 1024,
  design:   25 * 1024 * 1024,
}

const FORMAT_LABELS: Record<FileCategory, string> = {
  image:    'JPG, PNG, WEBP (máx. 10 MB)',
  document: 'PDF, JPG, PNG, WEBP, DOC, DOCX (máx. 20 MB)',
  design:   'PDF (máx. 25 MB)',
}

export function validateUploadFile(file: File, category: FileCategory): string | null {
  if (file.size > MAX_BYTES[category]) {
    const mb = MAX_BYTES[category] / (1024 * 1024)
    return `El archivo supera el límite de ${mb} MB.`
  }

  if (!ALLOWED_MIME[category].includes(file.type)) {
    return `Tipo de archivo no permitido. Formatos aceptados: ${FORMAT_LABELS[category]}.`
  }

  return null
}

// Removes path traversal sequences and chars unsafe for storage paths.
export function sanitizeFilename(name: string): string {
  return name
    .replace(/\.\./g, '')
    .replace(/[^\w.\-]/g, '_')
    .replace(/^[.\-]+/, '')
    .slice(0, 200)
}
