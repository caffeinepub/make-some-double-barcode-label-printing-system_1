import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLabelSettingsStore } from '../state/labelSettingsStore';
import { usePrinterStore } from '../services/printerService';
import { useSubmitPrintJob } from '../hooks/useQueries';
import { generateCPCL } from '../printing/cpclGenerator';
import { incrementScans, incrementPrints, incrementErrors, incrementTypeScans, incrementTypePrints } from '../state/diagnosticsStore';
import { addPrintHistory } from '../state/printHistoryStore';
import { addLog } from '../state/logStore';
import { normalizeSerial } from '../utils/serialNormalization';
import { formatPrinterError, formatBackendSubmissionError, isNonBlockingBackendError } from '../utils/scanPrintErrors';
import { playSound } from '../audio/soundSystem';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, ScanLine, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';

type ScanStep = 'scan1' | 'scan2' | 'confirm' | 'printing' | 'done';

interface ScanState {
  serial1: string;
  serial2: string;
  prefix: string;
  labelType: string;
  title: string;
}

export default function ScanPrintTab() {
  const settings = useLabelSettingsStore((s) => s.settings);
  const { status: printerStatus, printCPCL } = usePrinterStore();
  const submitPrintJob = useSubmitPrintJob();

  const [step, setStep] = useState<ScanStep>('scan1');
  const [scanState, setScanState] = useState<ScanState>({
    serial1: '',
    serial2: '',
    prefix: '',
    labelType: '',
    title: '',
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateSerialError, setDuplicateSerialError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on step change
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [step]);

  const resetWorkflow = useCallback(() => {
    setStep('scan1');
    setScanState({ serial1: '', serial2: '', prefix: '', labelType: '', title: '' });
    setErrorMessage(null);
    setDuplicateSerialError(null);
    setSuccessMessage(null);
    setInputValue('');
  }, []);

  const detectPrefixInfo = useCallback(
    (serial: string): { prefix: string; labelType: string; title: string } | null => {
      for (const [prefix, mapping] of Object.entries(settings.prefixMappings)) {
        if (serial.startsWith(prefix)) {
          return { prefix, labelType: mapping.labelType, title: mapping.title };
        }
      }
      return null;
    },
    [settings.prefixMappings]
  );

  const handleScan1 = useCallback(
    (raw: string) => {
      const serial = normalizeSerial(raw);
      if (!serial) return;

      setErrorMessage(null);
      setDuplicateSerialError(null);

      const info = detectPrefixInfo(serial);
      if (!info) {
        const msg = `Unknown prefix for serial: ${serial}`;
        setErrorMessage(msg);
        playSound('error');
        addLog('warn', msg);
        incrementErrors();
        setInputValue('');
        return;
      }

      setScanState((prev) => ({
        ...prev,
        serial1: serial,
        prefix: info.prefix,
        labelType: info.labelType,
        title: info.title,
      }));
      incrementScans();
      incrementTypeScans(info.prefix, info.labelType);
      playSound('success');
      setInputValue('');
      setStep('scan2');
    },
    [detectPrefixInfo]
  );

  const handleScan2 = useCallback(
    (raw: string) => {
      const serial = normalizeSerial(raw);
      if (!serial) return;

      setErrorMessage(null);
      setDuplicateSerialError(null);

      // Duplicate serial check: 2nd must differ from 1st
      if (serial === scanState.serial1) {
        const msg = 'Serial numbers must be unique — please scan a different serial number.';
        setDuplicateSerialError(msg);
        playSound('error');
        addLog('warn', `Duplicate serial detected: ${serial}`);
        setInputValue('');
        return;
      }

      const info = detectPrefixInfo(serial);
      if (!info) {
        const msg = `Unknown prefix for serial: ${serial}`;
        setErrorMessage(msg);
        playSound('error');
        addLog('warn', msg);
        incrementErrors();
        setInputValue('');
        return;
      }

      if (info.prefix !== scanState.prefix) {
        const msg = `Serial prefix mismatch: expected "${scanState.prefix}", got "${info.prefix}"`;
        setErrorMessage(msg);
        playSound('error');
        addLog('warn', msg);
        setInputValue('');
        return;
      }

      setScanState((prev) => ({ ...prev, serial2: serial }));
      incrementScans();
      incrementTypeScans(info.prefix, info.labelType);
      playSound('success');
      setInputValue('');
      setStep('confirm');
    },
    [scanState.serial1, scanState.prefix, detectPrefixInfo]
  );

  const handlePrint = useCallback(async () => {
    if (printerStatus !== 'connected') {
      setErrorMessage('Printer is not connected. Please connect a printer in the Devices tab.');
      return;
    }

    setStep('printing');
    setErrorMessage(null);

    try {
      const cpcl = generateCPCL(settings, scanState.serial1, scanState.serial2, scanState.prefix);

      await printCPCL(cpcl);

      addPrintHistory({
        timestamp: Date.now(),
        prefix: scanState.prefix,
        leftSerial: scanState.serial1,
        rightSerial: scanState.serial2,
        labelType: scanState.labelType,
        cpcl,
        success: true,
      });

      incrementPrints();
      incrementTypePrints(scanState.prefix, scanState.labelType);
      playSound('printComplete');
      addLog('info', `Printed label: ${scanState.serial1} / ${scanState.serial2}`);

      setSuccessMessage(`Label printed: ${scanState.serial1} / ${scanState.serial2}`);
      setStep('done');

      // Best-effort backend submission (non-blocking)
      submitPrintJob
        .mutateAsync({
          prefix: scanState.prefix,
          leftSerial: scanState.serial1,
          rightSerial: scanState.serial2,
        })
        .then(() => {
          addLog('info', 'Backend submission successful');
        })
        .catch((error: unknown) => {
          const msg = formatBackendSubmissionError(error);
          if (!isNonBlockingBackendError(error)) {
            addLog('warn', `Backend submission failed: ${msg}`);
          }
        });
    } catch (err: unknown) {
      const msg = formatPrinterError(err);
      setErrorMessage(msg);
      playSound('error');
      addLog('error', `Print failed: ${msg}`, { serial1: scanState.serial1, serial2: scanState.serial2 });
      incrementErrors();

      addPrintHistory({
        timestamp: Date.now(),
        prefix: scanState.prefix,
        leftSerial: scanState.serial1,
        rightSerial: scanState.serial2,
        labelType: scanState.labelType,
        cpcl: '',
        success: false,
      });

      setStep('confirm');
    }
  }, [printerStatus, scanState, settings, printCPCL, submitPrintJob]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = inputValue.trim();
      if (!val) return;
      if (step === 'scan1') handleScan1(val);
      else if (step === 'scan2') handleScan2(val);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (duplicateSerialError) setDuplicateSerialError(null);
    if (errorMessage) setErrorMessage(null);
  };

  const isPrinterConnected = printerStatus === 'connected';
  const prefixCount = Object.keys(settings.prefixMappings).length;

  return (
    <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      {/* Printer status */}
      <div className="flex items-center gap-2">
        <Printer className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Printer:</span>
        <Badge variant={isPrinterConnected ? 'default' : 'destructive'}>
          {isPrinterConnected ? 'Connected' : 'Disconnected'}
        </Badge>
      </div>

      {/* No prefix mappings warning */}
      {prefixCount === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No prefix mappings configured. Go to Label Settings → Prefixes to add mappings.
          </AlertDescription>
        </Alert>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        <StepBadge
          active={step === 'scan1'}
          done={['scan2', 'confirm', 'printing', 'done'].includes(step)}
          label="1. Scan Serial 1"
        />
        <div className="flex-1 h-px bg-border" />
        <StepBadge
          active={step === 'scan2'}
          done={['confirm', 'printing', 'done'].includes(step)}
          label="2. Scan Serial 2"
        />
        <div className="flex-1 h-px bg-border" />
        <StepBadge
          active={step === 'confirm' || step === 'printing'}
          done={step === 'done'}
          label="3. Print"
        />
      </div>

      {/* Generic error message */}
      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Success message */}
      {successMessage && step === 'done' && (
        <Alert className="border-green-500 bg-green-500/10">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-400">{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Scan step 1 */}
      {step === 'scan1' && (
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium flex items-center gap-2">
            <ScanLine className="w-4 h-4" />
            Scan First Serial Number
          </label>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder="Scan or type serial number..."
            className="w-full px-3 py-3 rounded-md border border-input bg-background text-foreground text-base focus:outline-none focus:ring-2 focus:ring-ring"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">Press Enter or scan barcode to confirm.</p>
        </div>
      )}

      {/* Scan step 2 */}
      {step === 'scan2' && (
        <div className="flex flex-col gap-3">
          <div className="rounded-md bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">Serial 1: </span>
            <span className="font-mono font-medium">{scanState.serial1}</span>
            <span className="ml-2 text-xs text-muted-foreground">
              ({scanState.title || scanState.labelType})
            </span>
          </div>

          <label className="text-sm font-medium flex items-center gap-2">
            <ScanLine className="w-4 h-4" />
            Scan Second Serial Number
          </label>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder="Scan or type serial number..."
            className="w-full px-3 py-3 rounded-md border border-input bg-background text-foreground text-base focus:outline-none focus:ring-2 focus:ring-ring"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />

          {/* Duplicate serial error shown inline near 2nd serial input */}
          {duplicateSerialError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{duplicateSerialError}</AlertDescription>
            </Alert>
          )}

          <p className="text-xs text-muted-foreground">
            Press Enter or scan barcode to confirm. Must be different from Serial 1.
          </p>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStep('scan1');
              setInputValue('');
              setErrorMessage(null);
              setDuplicateSerialError(null);
            }}
          >
            ← Re-scan Serial 1
          </Button>
        </div>
      )}

      {/* Confirm step */}
      {(step === 'confirm' || step === 'printing') && (
        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-border bg-muted/50 p-3 flex flex-col gap-2">
            <div className="text-sm font-medium">{scanState.title || scanState.labelType}</div>
            <div className="flex flex-col gap-1 text-sm">
              <div>
                <span className="text-muted-foreground">Serial 1: </span>
                <span className="font-mono">{scanState.serial1}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Serial 2: </span>
                <span className="font-mono">{scanState.serial2}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handlePrint}
              disabled={step === 'printing' || !isPrinterConnected}
              className="flex-1"
            >
              {step === 'printing' ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Printing...
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4 mr-2" />
                  Print Label
                </>
              )}
            </Button>
            <Button variant="outline" onClick={resetWorkflow} disabled={step === 'printing'}>
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Done step */}
      {step === 'done' && (
        <div className="flex flex-col gap-3">
          <Button onClick={resetWorkflow} className="w-full">
            <ScanLine className="w-4 h-4 mr-2" />
            Scan Next Label
          </Button>
        </div>
      )}
    </div>
  );
}

function StepBadge({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <span
      className={`text-xs px-2 py-1 rounded-full whitespace-nowrap transition-colors ${
        done
          ? 'bg-green-500/20 text-green-400'
          : active
          ? 'bg-primary/20 text-primary font-semibold'
          : 'bg-muted text-muted-foreground'
      }`}
    >
      {label}
    </span>
  );
}
