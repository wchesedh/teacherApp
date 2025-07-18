import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Utility function to format full name from separate name components
export function formatFullName(firstName: string, lastName: string, middleName?: string, suffix?: string): string {
  const parts = [firstName]
  
  if (middleName && middleName.trim()) {
    parts.push(middleName)
  }
  
  parts.push(lastName)
  
  if (suffix && suffix.trim()) {
    parts.push(suffix)
  }
  
  return parts.join(' ')
}

// Utility function to get display name (for backward compatibility)
export function getDisplayName(firstName?: string, lastName?: string, middleName?: string, suffix?: string, fallbackName?: string): string {
  if (firstName && lastName) {
    return formatFullName(firstName, lastName, middleName, suffix)
  }
  
  // Fallback to the old name field if available
  return fallbackName || 'Unknown'
}
