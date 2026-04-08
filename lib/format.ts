export function formatCurrency(value: number) {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return '-'

  const d = typeof date === 'string' ? new Date(date) : date

  return new Intl.DateTimeFormat('el-GR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}