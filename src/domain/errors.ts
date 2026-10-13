export function describeError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return 'No hay espacio suficiente en el almacenamiento del navegador. Elimina trabajos antiguos o libera espacio.';
  }
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado.';
}
