/**
 * Scan & Print specific error formatting utilities
 * Converts printer/transport/backend errors into concise user-facing strings
 */

import { isCanisterStoppedError } from './icErrors';

/**
 * Format a backend submission error for user display
 * Returns concise, actionable messages without raw replica rejection details
 */
export function formatBackendSubmissionError(error: any): string {
  if (!error) return 'Unknown error occurred';
  
  // Check for canister stopped first
  if (isCanisterStoppedError(error)) {
    return 'Backend unavailable - printing continues locally';
  }
  
  const errorMessage = error?.message || String(error);
  
  // Check for duplicate serial
  if (errorMessage.includes('Duplicate serial') || errorMessage.includes('already used')) {
    return 'Duplicate serial detected';
  }
  
  // Check for unknown prefix
  if (errorMessage.includes('Unknown prefix')) {
    return 'Unknown prefix';
  }
  
  // Check for authorization errors
  if (errorMessage.includes('Unauthorized') || errorMessage.includes('permission')) {
    return 'Authorization required';
  }
  
  // Check for network/connection errors
  if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connection')) {
    return 'Network error - check connection';
  }
  
  // Generic backend error
  return 'Backend submission failed';
}

/**
 * Format a printer send error for user display
 */
export function formatPrinterError(error: any): string {
  if (!error) return 'Printer error occurred';
  
  const errorMessage = error?.message || String(error);
  
  // Check for connection errors
  if (errorMessage.includes('not connected') || errorMessage.includes('disconnected')) {
    return 'Printer not connected';
  }
  
  // Check for USB/Bluetooth errors
  if (errorMessage.includes('USB') || errorMessage.includes('WebUSB')) {
    return 'USB communication error';
  }
  
  if (errorMessage.includes('Bluetooth')) {
    return 'Bluetooth communication error';
  }
  
  // Generic printer error
  return 'Failed to send to printer';
}

/**
 * Check if an error is a non-blocking backend submission failure
 * (i.e., printing succeeded but backend recording failed)
 */
export function isNonBlockingBackendError(error: any): boolean {
  return isCanisterStoppedError(error);
}
