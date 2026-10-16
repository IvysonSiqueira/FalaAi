export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));

let sequence = 0;
// O contador evita colisões mesmo em registros feitos no mesmo milissegundo.
export function createOccurrenceId() {
  sequence += 1;
  return `occurrence-${Date.now()}-${sequence}`;
}
