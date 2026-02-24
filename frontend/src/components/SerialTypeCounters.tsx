import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Printer } from 'lucide-react';
import { useDiagnostics } from '../state/diagnosticsStore';
import { useLabelSettings } from '../state/labelSettingsStore';

export default function SerialTypeCounters() {
  const { typeCounters } = useDiagnostics();
  const { settings } = useLabelSettings();

  // Empty state - no prefix mappings configured
  if (!settings || settings.prefixMappings.length === 0) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <Printer className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-base font-medium">No prefix mappings configured</p>
            <p className="text-sm mt-1">Configure prefix mappings in Label Settings to see counters here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Create a map of prefix mappings for easy lookup
  const mappingsMap = new Map(settings.prefixMappings);

  // Build counter cards for each configured prefix mapping
  const counterCards = Array.from(mappingsMap.entries()).map(([prefix, mapping]) => {
    const key = `${prefix}:${mapping.labelType}`;
    const counter = typeCounters[key];
    const printCount = counter?.prints ?? 0;

    // Use mapping title if available, otherwise fall back to labelType
    const displayTitle = mapping.title || mapping.labelType || prefix;

    return {
      key,
      prefix,
      title: displayTitle,
      count: printCount,
    };
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {counterCards.map((card) => (
        <Card key={card.key} className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Printer className="w-8 h-8 text-primary" />
              <span className="text-4xl font-bold tabular-nums">{card.count}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
