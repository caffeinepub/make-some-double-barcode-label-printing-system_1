import { isCanisterStoppedError, getCanisterStoppedMessage } from './icErrors';

/**
 * Parse label settings update errors and return user-friendly messages
 */
export function parseLabelSettingsError(error: any): string {
  // Check for IC0508 canister stopped error first
  if (isCanisterStoppedError(error)) {
    return getCanisterStoppedMessage();
  }
  
  const errorMessage = error?.message || String(error);
  
  // Check for authorization/admin errors
  if (
    errorMessage.includes('Unauthorized') ||
    errorMessage.includes('Only users can update') ||
    errorMessage.includes('Only admins can update') ||
    errorMessage.includes('permission') ||
    errorMessage.includes('admin')
  ) {
    return 'Admin access required to save label settings. Please use the admin link with the caffeineAdminToken parameter, or contact your administrator.';
  }
  
  // Check for network/actor errors
  if (
    errorMessage.includes('Actor not available') ||
    errorMessage.includes('network') ||
    errorMessage.includes('fetch')
  ) {
    return 'Network error: Unable to connect to the backend. Please check your connection and try again.';
  }
  
  // Check for duplicate serial errors
  if (errorMessage.includes('Duplicate')) {
    return errorMessage;
  }
  
  // Check for unknown prefix
  if (errorMessage.includes('Unknown prefix')) {
    return 'Unknown prefix: Please add this prefix in Label Settings before printing.';
  }
  
  // Generic fallback
  return errorMessage || 'Failed to save settings';
}
