import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, RotateCcw, Info } from 'lucide-react';
import { usePrinterService } from '../services/printerService';
import { useLabelSettings } from '../state/labelSettingsStore';
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
  
  const { isConnected, sendCPCL } = usePrinterService();
  const { settings } = useLabelSettings();
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
    if (!settings) return null;
    const mappings = new Map(settings.prefixMappings);
    for (const [prefix, mapping] of mappings.entries()) {
      if (serial.startsWith(prefix)) {
        return { prefix, ...mapping };
      }
    }
    return null;
  };

  const validateAndProcessLeftSerial = (value: string) => {
    // Normalize the serial (trim + remove scanner suffixes)
    const normalized = normalizeSerial(value);
    
    // Prevent duplicate validation for the same scan
    if (normalized === lastCompletedLeftRef.current) {
      return;
    }
    
    if (normalized.length < 3) return;
    
    lastCompletedLeftRef.current = normalized;
    
    // Update displayed value if normalization changed it
    if (normalized !== value) {
      setLeftSerial(normalized);
    }
    
    const mapping = getPrefixMapping(normalized);
    if (!mapping) {
      setLeftValidation('error');
      setErrorMessage('Unknown prefix');
      playSound('error');
      addLog('error', `Unknown prefix in serial: ${normalized}`);
      incrementErrors();
    } else {
      setDetectedType(mapping.labelType);
      setDetectedPrefix(mapping.prefix);
      setLeftValidation('success');
      playSound('success');
      addLog('info', `Detected label type: ${mapping.labelType} (${mapping.title})`);
      incrementScans();
      incrementTypeScans(mapping.prefix, mapping.labelType);
      
      // Move to step 2
      setTimeout(() => {
        setStep(2);
      }, 100);
    }
  };

  const validateAndProcessRightSerial = async (value: string) => {
    // Ignore if printing is in progress (lock state)
    if (isPrinting) {
      return;
    }
    
    // Normalize the serial (trim + remove scanner suffixes)
    const normalized = normalizeSerial(value);
    
    // Prevent duplicate validation for the same scan
    if (normalized === lastCompletedRightRef.current) {
      return;
    }
    
    if (normalized.length < 3 || !detectedPrefix || !detectedType) return;
    
    lastCompletedRightRef.current = normalized;
    
    // Update displayed value if normalization changed it
    if (normalized !== value) {
      setRightSerial(normalized);
    }
    
    const mapping = getPrefixMapping(normalized);
    
    if (!mapping) {
      setRightValidation('error');
      setErrorMessage('Unknown prefix');
      playSound('error');
      addLog('error', `Unknown prefix in serial: ${normalized}`);
      incrementErrors();
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
    
    // Check printer connection
    if (!isConnected) {
      setRightValidation('error');
      setErrorMessage('Printer not connected');
      playSound('error');
      addLog('error', 'Print failed: printer not connected');
      incrementErrors();
      return;
    }
    
    // Valid second scan - mark success
    setRightValidation('success');
    playSound('success');
    incrementScans();
    incrementTypeScans(detectedPrefix, detectedType);
    
    // Lock state - start printing (offline-first flow)
    setIsPrinting(true);
    setErrorMessage('');
    setBackendNotice('');
    
    const normalizedLeft = normalizeSerial(leftSerial);
    
    try {
      // Step 1: Generate CPCL from local settings
      const cpcl = generateCPCL(settings!, normalizedLeft, normalized, detectedPrefix);
      
      // Step 2: Send CPCL to printer (critical path)
      await sendCPCL(cpcl);
      
      // Step 3: Update local diagnostics and history (always succeeds)
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
      
      // Step 4: Immediately reset for next scan (no delay)
      resetForm();
      
      // Step 5: Best-effort backend submission (fire-and-forget, non-blocking)
      submitPrintJob.mutateAsync({
        prefix: detectedPrefix,
        leftSerial: normalizedLeft,
        rightSerial: normalized,
      }).then(() => {
        addLog('info', 'Backend submission successful');
      }).catch((backendError: any) => {
        // Backend failure is non-blocking - log only, don't interrupt workflow
        const formattedError = formatBackendSubmissionError(backendError);
        
        if (isNonBlockingBackendError(backendError)) {
          // Canister stopped - log as info
          addLog('info', `Backend submission skipped (canister stopped): ${formattedError}`);
        } else {
          // Other backend errors - log as warning
          addLog('warn', `Backend submission failed (non-blocking): ${formattedError}`);
        }
      });
      
    } catch (printerError: any) {
      // Printer send failed - this IS blocking
      const formattedError = formatPrinterError(printerError);
      setRightValidation('error');
      setErrorMessage(formattedError);
      playSound('error');
      addLog('error', `Print failed: ${formattedError}`);
      incrementErrors();
      setIsPrinting(false);
      // Do NOT reset form - allow user to retry
    }
  };

  const handleLeftSerialChange = (value: string) => {
    // Ignore changes during printing
    if (isPrinting) return;
    
    setLeftSerial(value);
    setErrorMessage('');
    setBackendNotice('');
    
    // Clear any existing timer
    if (scanCompleteTimerRef.current) {
      clearTimeout(scanCompleteTimerRef.current);
    }
    
    // Set a debounce timer to detect scan completion
    scanCompleteTimerRef.current = setTimeout(() => {
      validateAndProcessLeftSerial(value);
    }, 150);
  };

  const handleLeftSerialKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Ignore during printing
    if (isPrinting) return;
    
    // Detect Enter or Tab as scan completion
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      
      if (scanCompleteTimerRef.current) {
        clearTimeout(scanCompleteTimerRef.current);
      }
      
      // Use current input value (not stale state)
      const currentValue = e.currentTarget.value;
      validateAndProcessLeftSerial(currentValue);
    }
  };

  const handleRightSerialChange = (value: string) => {
    // Ignore changes during printing
    if (isPrinting) return;
    
    setRightSerial(value);
    setErrorMessage('');
    setBackendNotice('');
    
    // Clear any existing timer
    if (scanCompleteTimerRef.current) {
      clearTimeout(scanCompleteTimerRef.current);
    }
    
    // Set a debounce timer to detect scan completion
    scanCompleteTimerRef.current = setTimeout(() => {
      validateAndProcessRightSerial(value);
    }, 150);
  };

  const handleRightSerialKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Ignore during printing
    if (isPrinting) return;
    
    // Detect Enter or Tab as scan completion
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      
      if (scanCompleteTimerRef.current) {
        clearTimeout(scanCompleteTimerRef.current);
      }
      
      // Use current input value (not stale state)
      const currentValue = e.currentTarget.value;
      validateAndProcessRightSerial(currentValue);
    }
  };

  const resetForm = () => {
    // Clear any pending timers
    if (scanCompleteTimerRef.current) {
      clearTimeout(scanCompleteTimerRef.current);
    }
    
    // Reset last completed tracking
    lastCompletedLeftRef.current = '';
    lastCompletedRightRef.current = '';
    
    setLeftSerial('');
    setRightSerial('');
    setDetectedType(null);
    setDetectedPrefix(null);
    setLeftValidation('idle');
    setRightValidation('idle');
    setErrorMessage('');
    setBackendNotice('');
    setStep(1);
    setIsPrinting(false);
    leftInputRef.current?.focus();
  };

  const getInputBorderClass = (validation: FieldValidationState) => {
    if (validation === 'success') return 'border-green-500 border-2';
    if (validation === 'error') return 'border-destructive border-2';
    return '';
  };

  return (
    <div className="space-y-6">
      <SerialTypeCounters />

      {!isConnected && (
        <Alert variant="destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertDescription className="text-base font-medium">
            Printer not connected. Please connect printer in Devices tab before printing.
          </AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertDescription className="text-base font-medium">
            {errorMessage}
          </AlertDescription>
        </Alert>
      )}

      {backendNotice && (
        <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950/20">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-base font-medium text-blue-900 dark:text-blue-100">
            {backendNotice}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Scan Serials</span>
            <div className="flex items-center gap-3">
              {detectedType && (
                <Badge variant="outline" className="text-base px-3 py-1">
                  {getLabelTypeDisplayName(detectedType)}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={resetForm}
                disabled={isPrinting}
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Clear
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Step {step} of 2: Scan {step === 1 ? '1st' : '2nd'} Serial Number
            {isPrinting && ' - Printing...'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="left-serial" className="text-base">
              1st Serial Number {step === 1 && <span className="text-primary">← Scan here</span>}
            </Label>
            <Input
              ref={leftInputRef}
              id="left-serial"
              value={leftSerial}
              onChange={(e) => handleLeftSerialChange(e.target.value)}
              onKeyDown={handleLeftSerialKeyDown}
              className={`h-14 text-lg font-mono ${getInputBorderClass(leftValidation)}`}
              inputMode="none"
              autoComplete="off"
              disabled={step === 2 || isPrinting}
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="right-serial" className="text-base">
              2nd Serial Number {step === 2 && !isPrinting && <span className="text-primary">← Scan here</span>}
            </Label>
            <Input
              ref={rightInputRef}
              id="right-serial"
              value={rightSerial}
              onChange={(e) => handleRightSerialChange(e.target.value)}
              onKeyDown={handleRightSerialKeyDown}
              className={`h-14 text-lg font-mono ${getInputBorderClass(rightValidation)}`}
              inputMode="none"
              autoComplete="off"
              disabled={step === 1 || isPrinting}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
