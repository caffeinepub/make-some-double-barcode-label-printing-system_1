/**
 * Centralized label type definitions and utilities
 */

export interface LabelTypeInfo {
  id: string;
  value: string;
  displayName: string;
  isBuiltIn: boolean;
}

// Built-in label types
export const BUILT_IN_LABEL_TYPES: LabelTypeInfo[] = [
  { id: 'dualBand', value: 'dualBand', displayName: 'Dual Band', isBuiltIn: true },
  { id: 'triBand', value: 'triBand', displayName: 'Tri Band', isBuiltIn: true },
  { id: 'newDualBand', value: 'newDualBand', displayName: 'New Dual Band', isBuiltIn: true },
];

/**
 * Get display name for a label type
 */
export function getLabelTypeDisplayName(labelType: string): string {
  const builtIn = BUILT_IN_LABEL_TYPES.find((t) => t.value === labelType);
  if (builtIn) return builtIn.displayName;

  // For custom types, split on camelCase and capitalize
  return labelType
    .split(/(?=[A-Z])/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Extract custom label types from prefix mappings (Record form)
 */
export function extractCustomTypesFromRecord(
  prefixMappings: Record<string, { labelType: string; title: string }>
): LabelTypeInfo[] {
  const customTypes = new Set<string>();
  const builtInValues = new Set(BUILT_IN_LABEL_TYPES.map((t) => t.value));

  for (const mapping of Object.values(prefixMappings)) {
    if (mapping.labelType && !builtInValues.has(mapping.labelType)) {
      customTypes.add(mapping.labelType);
    }
  }

  return Array.from(customTypes).map((value) => ({
    id: value,
    value,
    displayName: getLabelTypeDisplayName(value),
    isBuiltIn: false,
  }));
}

/**
 * Extract custom label types from prefix mappings (Array form, legacy)
 */
export function extractCustomTypes(
  prefixMappings: Array<[string, { labelType: string; title: string }]>
): LabelTypeInfo[] {
  const customTypes = new Set<string>();
  const builtInValues = new Set(BUILT_IN_LABEL_TYPES.map((t) => t.value));

  for (const [, mapping] of prefixMappings) {
    if (mapping.labelType && !builtInValues.has(mapping.labelType)) {
      customTypes.add(mapping.labelType);
    }
  }

  return Array.from(customTypes).map((value) => ({
    id: value,
    value,
    displayName: getLabelTypeDisplayName(value),
    isBuiltIn: false,
  }));
}

/**
 * Get all available label types (built-in + custom) from Record-form mappings
 */
export function getMergedLabelTypes(
  prefixMappings: Record<string, { labelType: string; title: string }>
): LabelTypeInfo[] {
  const customFromMappings = extractCustomTypesFromRecord(prefixMappings);
  const builtInValues = new Set(BUILT_IN_LABEL_TYPES.map((t) => t.value));
  const existingCustomValues = new Set(customFromMappings.map((t) => t.value));

  return [...BUILT_IN_LABEL_TYPES, ...customFromMappings].sort((a, b) => {
    if (a.isBuiltIn && !b.isBuiltIn) return -1;
    if (!a.isBuiltIn && b.isBuiltIn) return 1;
    return a.displayName.localeCompare(b.displayName);
  });
}

/**
 * Get all available label types (built-in + custom) from Array-form mappings (legacy)
 */
export function getAllLabelTypes(
  prefixMappings: Array<[string, { labelType: string; title: string }]>,
  additionalCustomTypes: string[] = []
): LabelTypeInfo[] {
  const customFromMappings = extractCustomTypes(prefixMappings);
  const builtInValues = new Set(BUILT_IN_LABEL_TYPES.map((t) => t.value));
  const existingCustomValues = new Set(customFromMappings.map((t) => t.value));

  const additionalCustom = additionalCustomTypes
    .filter((type) => type && !builtInValues.has(type) && !existingCustomValues.has(type))
    .map((value) => ({
      id: value,
      value,
      displayName: getLabelTypeDisplayName(value),
      isBuiltIn: false,
    }));

  return [...BUILT_IN_LABEL_TYPES, ...customFromMappings, ...additionalCustom].sort((a, b) => {
    if (a.isBuiltIn && !b.isBuiltIn) return -1;
    if (!a.isBuiltIn && b.isBuiltIn) return 1;
    return a.displayName.localeCompare(b.displayName);
  });
}
