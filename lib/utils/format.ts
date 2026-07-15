/**
 * Formats a numeric value into FCFA format: e.g. "1 250 000 F"
 * All amounts in FCFA must be integers (rounded).
 */
export function formatFCFA(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0 F";
  
  const rounded = Math.round(num);
  // Format with spaces as thousands separators
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " F";
}

/**
 * Formats a date string or object into French format: e.g. "DD/MM/YYYY"
 */
export function formatDate(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return "-";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "-";
  
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
}

/**
 * Formats a phone number into readable format
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "-";
  // Clean phone input and format if possible
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 7)} ${cleaned.slice(7, 9)}`;
  }
  return phone;
}
