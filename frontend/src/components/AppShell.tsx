import { useState } from 'react';
import { usePasswordSession } from '../auth/PasswordSessionProvider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Lock, Scan, Settings, Wifi, Activity } from 'lucide-react';
import ScanPrintTab from '../tabs/ScanPrintTab';
import LabelSettingsTab from '../tabs/LabelSettingsTab';
import DevicesTab from '../tabs/DevicesTab';
import DiagnosticsTab from '../tabs/DiagnosticsTab';
import HeaderDeviceControls from './HeaderDeviceControls';
import BackendAvailabilityIndicator from './BackendAvailabilityIndicator';

export default function AppShell() {
  const { lock } = usePasswordSession();
  const [activeTab, setActiveTab] = useState('scan');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink">
            <div className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center bg-muted/30 rounded-md p-1">
              <img 
                src="/assets/generated/app-logo.dim_256x256.png" 
                alt="Make Some Double logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-foreground truncate">Make Some Double!!</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <BackendAvailabilityIndicator />
            <HeaderDeviceControls />
            <Button
              variant="outline"
              size="lg"
              onClick={lock}
              className="gap-2"
            >
              <Lock className="w-5 h-5" />
              <span className="hidden sm:inline">Lock</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <TabsList className="grid w-full grid-cols-4 h-16 mb-6">
            <TabsTrigger value="scan" className="text-base gap-2">
              <Scan className="w-5 h-5" />
              Scan & Print
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-base gap-2">
              <Settings className="w-5 h-5" />
              Label Settings
            </TabsTrigger>
            <TabsTrigger value="devices" className="text-base gap-2">
              <Wifi className="w-5 h-5" />
              Devices
            </TabsTrigger>
            <TabsTrigger value="diagnostics" className="text-base gap-2">
              <Activity className="w-5 h-5" />
              Diagnostics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scan" className="mt-0">
            <ScanPrintTab key={activeTab === 'scan' ? 'active' : 'inactive'} isActive={activeTab === 'scan'} />
          </TabsContent>
          <TabsContent value="settings" className="mt-0">
            <LabelSettingsTab />
          </TabsContent>
          <TabsContent value="devices" className="mt-0">
            <DevicesTab />
          </TabsContent>
          <TabsContent value="diagnostics" className="mt-0">
            <DiagnosticsTab />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t border-border bg-card py-4">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          © 2026. Built with ❤️ using{' '}
          <a
            href="https://caffeine.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            caffeine.ai
          </a>
        </div>
      </footer>
    </div>
  );
}
