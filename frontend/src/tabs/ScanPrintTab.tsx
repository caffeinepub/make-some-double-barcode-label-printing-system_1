import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, RotateCcw, Info } from 'lucide-react';
import { usePrinterService } from '../services/printerService';
import { useLabelSettingsStore } from '../state/labelSettingsStore';
import { generateCPCL } from '../printing/cpclGenerator';
import { playSound } from '../audio/soundSystem';
import { addLog } from '../state/logStore';
import { incrementScans, incrementPrints, incrementErrors, incrementTypeScans, incrementTypePrints } from '../state/diagnosticsStore';
import { addPrintHistory } from '../state/printHistoryStore';
import { useSubmitPrintJob } from '../hooks/useQueries';
import SerialTypeCounters from '../components/SerialTypeCounters';
import { getLabelTypeDisplayName } from '../utils/labelTypes';
import { normalizeSerial } from '../utils/serialNormalization';
import { formatBackendSubmissionError, formatPrinterError, isNonBlockingBackendError } from '../utils/scanPrintErrors';

type FieldValidationState = 'idle' | 'success' | 'error';

interface ScanPrintTabProps {
  isActive: boolean;
}

export default function ScanPrintTab({ isActive }: ScanPrintTabProps) {
  const [leftSerial, setLeftSerial] = useState('');
  const [rightSerial, setRightSerial] = useState('');
  const [detectedType, setDetectedType] = useState<string | null>(null);
  const [detectedPrefix, setDetectedPrefix] = useState<string | null>(null);
  const [leftValidation, setLeftValidation] = useState<FieldValidationState>('idle');
  const [rightValidation, setRightValidation] = useState<FieldValidationState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [backendNotice, setBackendNotice] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [isPrinting, setIsPrinting] = useState(false);

  const leftInputRef = useRef<HTMLInputElement>(null);
  const rightInputRef = useRef<HTMLInputElement>(null);
  const scanCompleteTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track last completed value per field to prevent duplicate validation
  const lastCompletedLeftRef = useRef<string>('');
  const lastCompletedRightRef = useRef<string>('');

  // Track recently scanned serials for duplicate detection (last 100 scans)
  const recentScansRef = useRef<Set<string>>(new Set());

  const { isConnected, sendCPCL } = usePrinterService();
  const { settings } = useLabelSettingsStore();
  const submitPrintJob = useSubmitPrintJob();

  // Autofocus on mount and when tab becomes active
  useEffect(() => {
    if (isActive && step === 1) {
      leftInputRef.current?.focus();
    }
  }, [isActive, step]);

  // Focus management between steps
  useEffect(() => {
    if (step === 1) {
      leftInputRef.current?.focus();
    } else if (step === 2) {
      rightInputRef.current?.focus();
    }
  }, [step]);

  const getPrefixMapping = (serial: string) => {
    const prefixEntries = Object.entries(settings.prefixMappings);
    for (const [prefix, mapping] of prefixEntries) {
      if (serial.startsWith(prefix)) {
        return { prefix, ...mapping };
      }
    }
    return null;
  };

  const checkDuplicateSerial = (serial: string): boolean => {
    return recentScansRef.current.has(serial);
  };

  const addToRecentScans = (serial: string) => {
    recentScansRef.current.add(serial);
    // Keep only last 100 scans
    if (recentScansRef.current.size > 100) {
      const iterator = recentScansRef.current.values();
      const firstItem = iterator.next().value;
      if (firstItem !== undefined) {
        recentScansRef.current.delete(firstItem);
      }
    }
  };

  const validateAndProcessLeftSerial = (value: string) => {
    const normalized = normalizeSerial(value);

    if (normalized === lastCompletedLeftRef.current) return;
    if (normalized.length < 3) return;

    lastCompletedLeftRef.current = normalized;

    if (normalized !== value) {
      setLeftSerial(normalized);
    }

    const mapping = getPrefixMapping(normalized);
    if (!mapping) {
      setLeftValidation('error');
      setErrorMessage('Unknown prefix - scan again');
      playSound('error');
      addLog('error', `Unknown prefix in serial: ${normalized}`);
      incrementErrors();

      setTimeout(() => {
        setLeftSerial('');
        setLeftValidation('idle');
        setErrorMessage('');
        lastCompletedLeftRef.current = '';
        leftInputRef.current?.focus();
      }, 1500);
      return;
    }

    if (checkDuplicateSerial(normalized)) {
      setLeftValidation('error');
      setErrorMessage('Duplicate serial detected - scan again');
      playSound('error');
      addLog('error', `Duplicate serial detected: ${normalized}`);
      incrementErrors();

      setTimeout(() => {
        setLeftSerial('');
        setLeftValidation('idle');
        setErrorMessage('');
        lastCompletedLeftRef.current = '';
        leftInputRef.current?.focus();
      }, 1500);
      return;
    }

    setDetectedType(mapping.labelType);
    setDetectedPrefix(mapping.prefix);
    setLeftValidation('success');
    playSound('success');
    addLog('info', `Detected label type: ${mapping.labelType} (${mapping.title})`);
    incrementScans();
    incrementTypeScans(mapping.prefix, mapping.labelType);

    setTimeout(() => {
      setStep(2);
    }, 100);
  };

  const validateAndProcessRightSerial = async (value: string) => {
    if (isPrinting) return;

    const normalized = normalizeSerial(value);

    if (normalized === lastCompletedRightRef.current) return;
    if (normalized.length < 3 || !detectedPrefix || !detectedType) return;

    lastCompletedRightRef.current = normalized;

    if (normalized !== value) {
      setRightSerial(normalized);
    }

    const mapping = getPrefixMapping(normalized);

    if (!mapping) {
      setRightValidation('error');
      setErrorMessage('Unknown prefix - scan again');
      playSound('error');
      addLog('error', `Unknown prefix in serial: ${normalized}`);
      incrementErrors();

      setTimeout(() => {
        setRightSerial('');
        setRightValidation('idle');
        setErrorMessage('');
        lastCompletedRightRef.current = '';
        rightInputRef.current?.focus();
      }, 1500);
      return;
    }

    if (checkDuplicateSerial(normalized)) {
      setRightValidation('error');
      setErrorMessage('Duplicate serial detected - scan again');
      playSound('error');
      addLog('error', `Duplicate serial detected: ${normalized}`);
      incrementErrors();

      setTimeout(() => {
        setRightSerial('');
        setRightValidation('idle');
        setErrorMessage('');
        lastCompletedRightRef.current = '';
        rightInputRef.current?.focus();
      }, 1500);
      return;
    }

    if (mapping.labelType !== detectedType) {
      setRightValidation('error');
      setErrorMessage(`Label type mismatch: expected ${getLabelTypeDisplayName(detectedType)}, got ${getLabelTypeDisplayName(mapping.labelType)}`);
      playSound('error');
      addLog('error', `Label type mismatch: expected ${detectedType}, got ${mapping.labelType}`);
      incrementErrors();
      return;
    }

    if (!isConnected) {
      setRightValidation('error');
      setErrorMessage('Printer not connected');
      playSound('error');
      addLog('error', 'Print failed: printer not connected');
      incrementErrors();
      return;
    }

    setRightValidation('success');
    playSound('success');
    incrementScans();
    incrementTypeScans(detectedPrefix, detectedType);

    setIsPrinting(true);
    setErrorMessage('');
    setBackendNotice('');

    const normalizedLeft = normalizeSerial(leftSerial);

    try {
      // Generate CPCL from local settings
      const cpcl = generateCPCL(settings, normalizedLeft, normalized, detectedPrefix);

      // Send CPCL to printer (critical path)
      await sendCPCL(cpcl);

      // Add serials to recent scans for duplicate detection
      addToRecentScans(normalizedLeft);
      addToRecentScans(normalized);

      // Update local diagnostics and history
      addPrintHistory({
        timestamp: Date.now(),
        prefix: detectedPrefix,
        leftSerial: normalizedLeft,
        rightSerial: normalized,
        labelType: detectedType,
        cpcl,
        success: true,
      });

      incrementPrints();
      incrementTypePrints(detectedPrefix, detectedType);
      playSound('printComplete');
      addLog('info', `Print completed: ${normalizedLeft} / ${normalized}`);

      resetForm();

      // Best-effort backend submission (fire-and-forget, non-blocking)
      submitPrintJob.mutateAsync({
        prefix: detectedPrefix,
        leftSerial: normalizedLeft,
        rightSerial: normalized,
      }).then(() => {
        addLog('info', 'Backend submission successful');
      }).catch((error: any) => {
        const msg = formatBackendSubmissionError(error);
        if (!isNonBlockingBackendError(error)) {
          setBackendNotice(msg);
        }
        addLog('warn', `Backend submission failed (non-blocking): ${msg}`);
      });

    } catch (error: any) {
      const msg = formatPrinterError(error);
      setRightValidation('error');
      setErrorMessage(msg);
      playSound('error');
      addLog('error', `Print failed: ${msg}`);
      incrementErrors();

      addPrintHistory({
        timestamp: Date.now(),
        prefix: detectedPrefix,
        leftSerial: normalizedLeft,
        rightSerial: normalized,
        labelType: detectedType,
        cpcl: '',
        success: false,
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const resetForm = () => {
    setLeftSerial('');
    setRightSerial('');
    setDetectedType(null);
    setDetectedPrefix(null);
    setLeftValidation('idle');
    setRightValidation('idle');
    setErrorMessage('');
    setBackendNotice('');
    setStep(1);
    lastCompletedLeftRef.current = '';
    lastCompletedRightRef.current = '';
    if (scanCompleteTimerRef.current) {
      clearTimeout(scanCompleteTimerRef.current);
    }
  };

  const getValidationBorderClass = (state: FieldValidationState) => {
    if (state === 'success') return 'border-green-500 focus:border-green-500';
    if (state === 'error') return 'border-red-500 focus:border-red-500';
    return '';
  };

  const prefixCount = Object.keys(settings.prefixMappings).length;

  return (
    <div className="space-y-6">
      {/* Counters */}
      <SerialTypeCounters />

      {/* Scan workflow */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Scan &amp; Print</CardTitle>
              <CardDescription>
                {prefixCount === 0
                  ? 'Configure prefix mappings in Label Settings first'
                  : `Step ${step} of 2 — scan ${step === 1 ? 'left' : 'right'} serial`}
              </CardDescription>
            </div>
            {(step === 2 || errorMessage) && (
              <Button variant="outline" size="sm" onClick={resetForm} className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {prefixCount === 0 && (
            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription>
                No prefix mappings configured. Go to Label Settings → Prefixes to add mappings.
              </AlertDescription>
            </Alert>
          )}

          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {backendNotice && !errorMessage && (
            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription className="text-yellow-600">{backendNotice}</AlertDescription>
            </Alert>
          )}

          {/* Step 1: Left serial */}
          <div className="space-y-2">
            <Label htmlFor="left-serial" className="flex items-center gap-2">
              Left Serial
              {step === 1 && <Badge variant="default" className="text-xs">Active</Badge>}
              {leftValidation === 'success' && <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-400">✓</Badge>}
            </Label>
            <Input
              id="left-serial"
              ref={leftInputRef}
              value={leftSerial}
              onChange={(e) => setLeftSerial(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && leftSerial.trim()) {
                  validateAndProcessLeftSerial(leftSerial);
                }
              }}
              onBlur={() => {
                if (leftSerial.trim() && step === 1) {
                  validateAndProcessLeftSerial(leftSerial);
                }
              }}
              placeholder="Scan or type left serial..."
              disabled={step !== 1 || isPrinting}
              className={`font-mono text-lg h-12 ${getValidationBorderClass(leftValidation)}`}
              autoComplete="off"
            />
            {detectedType && (
              <p className="text-xs text-muted-foreground">
                Detected: <span className="font-medium text-green-400">{getLabelTypeDisplayName(detectedType)}</span>
              </p>
            )}
          </div>

          {/* Step 2: Right serial */}
          <div className="space-y-2">
            <Label htmlFor="right-serial" className="flex items-center gap-2">
              Right Serial
              {step === 2 && <Badge variant="default" className="text-xs">Active</Badge>}
              {rightValidation === 'success' && <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-400">✓</Badge>}
            </Label>
            <Input
              id="right-serial"
              ref={rightInputRef}
              value={rightSerial}
              onChange={(e) => setRightSerial(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && rightSerial.trim()) {
                  validateAndProcessRightSerial(rightSerial);
                }
              }}
              onBlur={() => {
                if (rightSerial.trim() && step === 2) {
                  validateAndProcessRightSerial(rightSerial);
                }
              }}
              placeholder="Scan or type right serial..."
              disabled={step !== 2 || isPrinting}
              className={`font-mono text-lg h-12 ${getValidationBorderClass(rightValidation)}`}
              autoComplete="off"
            />
          </div>

          {isPrinting && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="animate-spin">⏳</span>
              Printing...
            </div>
          )}

          {!isConnected && (
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                No printer connected. Connect a printer in the Devices tab.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
