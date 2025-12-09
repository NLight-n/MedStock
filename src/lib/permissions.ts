export const normalizePermissionName = (name: string) =>
  (name || '')
    // Convert camelCase / PascalCase to spaced words
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()

export const hasPermissionByName = (
  permissions: Array<{ name: string }> | string[],
  required: string
) => {
  const requiredKey = normalizePermissionName(required)
  return permissions.some((p: { name: string } | string) => {
    const currentName = typeof p === 'string' ? p : p.name
    return normalizePermissionName(currentName) === requiredKey
  })
}

