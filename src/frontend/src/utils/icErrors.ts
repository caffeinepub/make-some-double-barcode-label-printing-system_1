/**
 * Utility to detect Internet Computer operational availability errors
 * Specifically handles IC0508 "canister is stopped" errors
 */

export interface ICError {
  message?: string;
  reject_code?: number;
  error_code?: string;
  reject_message?: string;
}

/**
 * Detects if an error is an IC0508 "canister is stopped" error
 */
export function isCanisterStoppedError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error?.message || String(error);
  const rejectCode = error?.reject_code;
  const errorCode = error?.error_code;
  const rejectMessage = error?.reject_message;
  
  // Check for IC0508 error code
  if (errorCode === 'IC0508') return true;
  
  // Check for reject code 5 (canister error)
  if (rejectCode === 5) return true;
  
  // Check for "canister is stopped" text in various fields
  if (
    errorMessage?.includes('canister is stopped') ||
    errorMessage?.includes('Canister') && errorMessage?.includes('is stopped') ||
    rejectMessage?.includes('canister is stopped') ||
    rejectMessage?.includes('Canister') && rejectMessage?.includes('is stopped')
  ) {
    return true;
  }
  
  return false;
}

/**
 * Returns a user-friendly message for canister stopped errors
 * Tailored for Scan & Print context where printing can continue locally
 */
export function getCanisterStoppedMessage(): string {
  return 'Backend unavailable. Printing continues locally with connected printer.';
}

/**
 * Extracts a concise error message from IC replica rejection errors
 * Removes request IDs, reject codes, and embedded JSON for user-facing display
 */
export function formatICError(error: any): string {
  if (!error) return 'Unknown error';
  
  // Check for canister stopped first
  if (isCanisterStoppedError(error)) {
    return getCanisterStoppedMessage();
  }
  
  const errorMessage = error?.message || String(error);
  
  // Try to extract just the reject_message if available
  if (error?.reject_message && typeof error.reject_message === 'string') {
    return error.reject_message;
  }
  
  // Remove common IC error prefixes and metadata
  let cleaned = errorMessage
    .replace(/The replica returned a rejection error:.*?Reject text:/i, '')
    .replace(/Request ID:.*?(?=Reject|Error|$)/gi, '')
    .replace(/Reject code:.*?(?=Reject text|Error code|$)/gi, '')
    .replace(/Error code:.*?(?=Call context|HTTP details|$)/gi, '')
    .replace(/Call context:.*?(?=HTTP details|$)/gi, '')
    .replace(/HTTP details:.*$/gi, '')
    .trim();
  
  // If we still have a long technical message, try to extract the core issue
  if (cleaned.length > 100) {
    // Look for common error patterns
    const patterns = [
      /Canister [^\s]+ is stopped/i,
      /Unauthorized[^.]*\./i,
      /Duplicate serial[^.]*\./i,
      /Unknown prefix[^.]*\./i,
      /permission denied[^.]*\./i,
    ];
    
    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        return match[0];
      }
    }
    
    // If no pattern matched, return first sentence
    const firstSentence = cleaned.split(/[.!?]/)[0];
    if (firstSentence && firstSentence.length < 100) {
      return firstSentence;
    }
  }
  
  return cleaned || 'Backend error occurred';
}
