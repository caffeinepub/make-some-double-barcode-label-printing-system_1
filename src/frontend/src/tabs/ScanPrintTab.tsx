import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
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
  const [step, setStep] = useState<1 | 2>(1);
  const [isPrinting, setIsPrinting] = useState(false);
  
  const leftInputRef = useRef<HTMLInputElement>(null);
  const rightInputRef = useRef<HTMLInputElement>(null);
  
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

  const handleLeftSerialChange = (value: string) => {
    setLeftSerial(value);
    setErrorMessage('');
    
    if (value.length >= 3) {
      const mapping = getPrefixMapping(value);
      if (!mapping) {
        setLeftValidation('error');
        setErrorMessage('Unknown prefix');
        playSound('error');
        addLog('error', `Unknown prefix in serial: ${value}`);
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
    }
  };

  const handleRightSerialChange = async (value: string) => {
    setRightSerial(value);
    setErrorMessage('');
    
    if (value.length >= 3 && detectedPrefix && detectedType) {
      const mapping = getPrefixMapping(value);
      
      if (!mapping) {
        setRightValidation('error');
        setErrorMessage('Unknown prefix');
        playSound('error');
        addLog('error', `Unknown prefix in serial: ${value}`);
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
      
      // Valid second scan - mark success and auto print
      setRightValidation('success');
      playSound('success');
      incrementScans();
      incrementTypeScans(detectedPrefix, detectedType);
      
      // Start printing
      setIsPrinting(true);
      
      try {
        // Submit to backend
        await submitPrintJob.mutateAsync({
          prefix: detectedPrefix,
          leftSerial,
          rightSerial: value,
        });
        
        // Generate CPCL
        const cpcl = generateCPCL(settings!, leftSerial, value, detectedPrefix);
        
        // Actually send CPCL to printer
        await sendCPCL(cpcl);
        
        addLog('info', `Printing label: ${leftSerial} / ${value}`);
        
        // Save to history with success
        addPrintHistory({
          timestamp: Date.now(),
          prefix: detectedPrefix,
          leftSerial,
          rightSerial: value,
          labelType: detectedType,
          cpcl,
          success: true,
        });
        
        incrementPrints();
        incrementTypePrints(detectedPrefix, detectedType);
        playSound('printComplete');
        addLog('info', 'Print completed successfully');
        
        // Reset for next scan
        setTimeout(() => {
          resetForm();
        }, 500);
        
      } catch (error: any) {
        setRightValidation('error');
        setErrorMessage(error.message || 'Print failed');
        playSound('error');
        addLog('error', `Print failed: ${error.message}`);
        incrementErrors();
        setIsPrinting(false);
      }
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Scan Serials
            {detectedType && (
              <Badge variant="outline" className="text-base px-3 py-1">
                {getLabelTypeDisplayName(detectedType)}
              </Badge>
            )}
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
