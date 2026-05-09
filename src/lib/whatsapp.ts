/**
 * Format a Pakistani phone number to international format.
 * - Removes spaces, +, dashes
 * - Converts 03xx → 923xx
 */
export function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[\s+\-()]/g, '');
  if (cleaned.startsWith('03')) {
    cleaned = '92' + cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Detect if the user is on a mobile device.
 */
function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
    navigator.userAgent
  );
}

/**
 * Open a WhatsApp chat with a pre-filled message.
 * Mobile/webview: uses whatsapp:// deep link for direct app open.
 * Desktop: uses wa.me in a new tab.
 */
export function openWhatsApp(phone: string, message: string): void {
  const formattedPhone = formatPhoneNumber(phone);
  const encodedMessage = encodeURIComponent(message);

  if (isMobileDevice()) {
    window.location.href = `whatsapp://send?phone=${formattedPhone}&text=${encodedMessage}`;
  } else {
    window.open(`https://wa.me/${formattedPhone}?text=${encodedMessage}`, '_blank');
  }
}

/**
 * Build the reminder message template.
 */
export function buildReminderMessage({
  name,
  dueDate,
  gymName,
}: {
  name: string;
  dueDate: string;
  gymName: string;
}): string {
  return `Hi ${name} 👋\nYour gym membership fee is due on ${dueDate}.\n\nPlease pay your fee to continue workouts 💪\n\n– ${gymName}`;
}

/**
 * Build inactive member reminder message.
 */
export function buildInactiveReminderMessage({
  name,
  daysAbsent,
  gymName,
}: {
  name: string;
  daysAbsent: number;
  gymName: string;
}): string {
  return `Hi ${name} 👋\n\nWe noticed you haven't visited the gym for ${daysAbsent} days.\n\nConsistency is the key to results 💪\nCome back and continue your fitness journey!\n\n– ${gymName}`;
}
