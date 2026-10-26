export function apiErrorMessage(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const messages = detail.map(item => {
      const field = Array.isArray(item?.loc) ? item.loc.filter((v: unknown) => v !== 'body').join('.') : '';
      return typeof item?.msg === 'string' ? `${field ? field + ': ' : ''}${item.msg}` : '';
    }).filter(Boolean);
    if (messages.length) return messages.join('\n');
  }
  return error instanceof Error ? error.message : fallback;
}
