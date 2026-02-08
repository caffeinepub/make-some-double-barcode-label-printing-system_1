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
 */
export function getCanisterStoppedMessage(): string {
  return 'Backend canister is stopped. The canister must be restarted or redeployed before operations can continue. Please contact your administrator or redeploy the application.';
}
