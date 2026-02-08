import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Activity, History, FileText, Volume2, Play } from 'lucide-react';
import { useDiagnostics } from '../state/diagnosticsStore';
import { usePrintHistory } from '../state/printHistoryStore';
import { useLogs } from '../state/logStore';
import { useSoundSettings, playTestSound } from '../audio/soundSystem';

export default function DiagnosticsTab() {
  const diagnostics = useDiagnostics();
  const { history, reprint } = usePrintHistory();
  const { logs } = useLogs();
  const { settings, updateSettings } = useSoundSettings();
  const [selectedLogLevel, setSelectedLogLevel] = useState<'all' | 'info' | 'warn' | 'error'>('all');

  const filteredLogs = selectedLogLevel === 'all' 
    ? logs 
    : logs.filter(log => log.level === selectedLogLevel);

  const handleReprint = (index: number) => {
    reprint(index);
  };

  const typeCountersArray = Object.values(diagnostics.typeCounters).sort((a, b) => {
    if (a.labelType !== b.labelType) {
      return a.labelType.localeCompare(b.labelType);
    }
    return a.prefix.localeCompare(b.prefix);
  });

  return (
    <Tabs defaultValue="stats" className="space-y-6">
      <TabsList className="grid w-full grid-cols-4 h-14">
        <TabsTrigger value="stats" className="text-base gap-2">
          <Activity className="w-4 h-4" />
          Stats
        </TabsTrigger>
        <TabsTrigger value="history" className="text-base gap-2">
          <History className="w-4 h-4" />
          History
        </TabsTrigger>
        <TabsTrigger value="logs" className="text-base gap-2">
          <FileText className="w-4 h-4" />
          Logs
        </TabsTrigger>
        <TabsTrigger value="sounds" className="text-base gap-2">
          <Volume2 className="w-4 h-4" />
          Sounds
        </TabsTrigger>
      </TabsList>

      <TabsContent value="stats" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Total Scans</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{diagnostics.totalScans}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Labels Printed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{diagnostics.labelsPrinted}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Errors</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-destructive">{diagnostics.errors}</p>
            </CardContent>
          </Card>
        </div>

        {typeCountersArray.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Counters by Serial Type</CardTitle>
              <CardDescription>
                Breakdown of scans and prints by prefix and label type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Label Type</TableHead>
                    <TableHead className="text-right">Scans</TableHead>
                    <TableHead className="text-right">Prints</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typeCountersArray.map((counter) => (
                    <TableRow key={`${counter.prefix}:${counter.labelType}`}>
                      <TableCell className="font-mono">{counter.prefix}</TableCell>
                      <TableCell>{counter.labelType}</TableCell>
                      <TableCell className="text-right font-semibold">{counter.scans}</TableCell>
                      <TableCell className="text-right font-semibold">{counter.prints}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="history">
        <Card>
          <CardHeader>
            <CardTitle>Print History</CardTitle>
            <CardDescription>
              Recent print jobs with reprint capability
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Left Serial</TableHead>
                    <TableHead>Right Serial</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No print history yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    history.map((entry, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-sm">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{entry.labelType}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{entry.leftSerial}</TableCell>
                        <TableCell className="font-mono text-sm">{entry.rightSerial}</TableCell>
                        <TableCell>
                          <Badge variant={entry.success ? 'default' : 'destructive'}>
                            {entry.success ? 'Success' : 'Failed'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReprint(index)}
                          >
                            Reprint
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="logs">
        <Card>
          <CardHeader>
            <CardTitle>System Logs</CardTitle>
            <CardDescription>
              Detailed system activity and error logs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Label htmlFor="log-level">Filter by level:</Label>
              <Select value={selectedLogLevel} onValueChange={(value: any) => setSelectedLogLevel(value)}>
                <SelectTrigger id="log-level" className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {filteredLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No logs to display
                  </p>
                ) : (
                  filteredLogs.map((log, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border"
                    >
                      <Badge
                        variant={
                          log.level === 'error'
                            ? 'destructive'
                            : log.level === 'warn'
                            ? 'outline'
                            : 'default'
                        }
                        className="mt-0.5"
                      >
                        {log.level}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString()}
                        </p>
                        <p className="text-sm break-words">{log.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="sounds">
        <Card>
          <CardHeader>
            <CardTitle>Sound Configuration</CardTitle>
            <CardDescription>
              Configure audio feedback for different events
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="volume">Volume</Label>
                  <span className="text-sm text-muted-foreground">
                    {Math.round(settings.volume * 100)}%
                  </span>
                </div>
                <Slider
                  id="volume"
                  min={0}
                  max={1}
                  step={0.1}
                  value={[settings.volume]}
                  onValueChange={([value]) => updateSettings({ volume: value })}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <Label>Success Sound</Label>
                <div className="flex gap-2">
                  <Select
                    value={settings.successSound}
                    onValueChange={(value: any) => updateSettings({ successSound: value })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beep">Beep</SelectItem>
                      <SelectItem value="chime">Chime</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => playTestSound('success')}
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Error Sound</Label>
                <div className="flex gap-2">
                  <Select
                    value={settings.errorSound}
                    onValueChange={(value: any) => updateSettings({ errorSound: value })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buzz">Buzz</SelectItem>
                      <SelectItem value="alert">Alert</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => playTestSound('error')}
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Print Complete Sound</Label>
                <div className="flex gap-2">
                  <Select
                    value={settings.printCompleteSound}
                    onValueChange={(value: any) => updateSettings({ printCompleteSound: value })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => playTestSound('printComplete')}
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
