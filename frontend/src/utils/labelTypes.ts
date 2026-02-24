/**
 * Centralized label type definitions and utilities
 */

export interface LabelTypeInfo {
  value: string;
  displayName: string;
  isBuiltIn: boolean;
}

// Built-in label types
export const BUILT_IN_LABEL_TYPES: LabelTypeInfo[] = [
  { value: 'dualBand', displayName: 'Dual Band', isBuiltIn: true },
  { value: 'triBand', displayName: 'Tri Band', isBuiltIn: true },
  { value: 'newDualBand', displayName: 'New Dual Band', isBuiltIn: true },
];

/**
 * Get display name for a label type
 */
export function getLabelTypeDisplayName(labelType: string): string {
  const builtIn = BUILT_IN_LABEL_TYPES.find(t => t.value === labelType);
  if (builtIn) return builtIn.displayName;
  
  // For custom types, capitalize first letter of each word
  return labelType
    .split(/(?=[A-Z])/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Extract custom label types from prefix mappings
 */
export function extractCustomTypes(
  prefixMappings: Array<[string, { labelType: string; title: string }]>
): LabelTypeInfo[] {
  const customTypes = new Set<string>();
  const builtInValues = new Set(BUILT_IN_LABEL_TYPES.map(t => t.value));
  
  for (const [, mapping] of prefixMappings) {
    if (mapping.labelType && !builtInValues.has(mapping.labelType)) {
      customTypes.add(mapping.labelType);
    }
  }
  
  return Array.from(customTypes).map(value => ({
    value,
    displayName: getLabelTypeDisplayName(value),
    isBuiltIn: false,
  }));
}

/**
 * Get all available label types (built-in + custom)
 */
export function getAllLabelTypes(
  prefixMappings: Array<[string, { labelType: string; title: string }]>,
  additionalCustomTypes: string[] = []
): LabelTypeInfo[] {
  const customFromMappings = extractCustomTypes(prefixMappings);
  const builtInValues = new Set(BUILT_IN_LABEL_TYPES.map(t => t.value));
  const existingCustomValues = new Set(customFromMappings.map(t => t.value));
  
  const additionalCustom = additionalCustomTypes
    .filter(type => type && !builtInValues.has(type) && !existingCustomValues.has(type))
    .map(value => ({
      value,
      displayName: getLabelTypeDisplayName(value),
      isBuiltIn: false,
    }));
  
  return [...BUILT_IN_LABEL_TYPES, ...customFromMappings, ...additionalCustom].sort((a, b) => {
    // Built-in types first, then alphabetically
    if (a.isBuiltIn && !b.isBuiltIn) return -1;
    if (!a.isBuiltIn && b.isBuiltIn) return 1;
    return a.displayName.localeCompare(b.displayName);
  });
}
