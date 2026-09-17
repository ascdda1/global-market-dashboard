export type SafeProviderError = {
  category: 'timeout' | 'http' | 'upstream';
  status?: number;
};

function providerName(provider: string) {
  return provider.replace(/[^a-z0-9 .&-]/gi, '').trim() || 'Provider';
}

export function sanitizeProviderError(error: unknown): SafeProviderError {
  const message = error instanceof Error ? error.message : '';
  if (/timed out|abort/i.test(message)) return { category: 'timeout' };

  const statusMatch = message.match(/\b([1-5]\d{2})\b/);
  if (statusMatch) return { category: 'http', status: Number(statusMatch[1]) };

  return { category: 'upstream' };
}

export function safeErrorMessage(provider: string, subject = 'request') {
  return `${providerName(provider)} ${subject} failed; fallback data used`;
}

export function safeConfigurationMessage(provider: string) {
  return `${providerName(provider)} is not configured; fallback data used`;
}

export function sanitizePublicErrors(provider: string, errors: unknown) {
  return Array.isArray(errors) && errors.length > 0 ? [safeErrorMessage(provider)] : [];
}

export function recordProviderFailure(provider: string, error: unknown, context?: Record<string, string>) {
  const details = sanitizeProviderError(error);
  console.warn('Provider request failed', {
    provider: providerName(provider),
    category: details.category,
    ...(details.status ? { status: details.status } : {}),
    ...context,
  });
}
