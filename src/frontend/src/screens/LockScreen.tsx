import { useState, useRef, useEffect } from 'react';
import { usePasswordSession } from '../auth/PasswordSessionProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock } from 'lucide-react';

export default function LockScreen() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const { unlock } = usePasswordSession();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleUnlock = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!password.trim()) {
      setError('Please enter a password');
      return;
    }

    setIsUnlocking(true);
    setError('');

    // Small delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 100));

    const success = unlock(password);
    
    if (!success) {
      setError('Invalid password. Please try again.');
      setPassword('');
      setIsUnlocking(false);
      // Refocus input after failed attempt
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
    // If success, the component will unmount as app unlocks
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleUnlock();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">Make Some Double!!</CardTitle>
          <CardDescription className="text-base">
            Enter password to access the barcode & label printing system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleUnlock} className="space-y-3">
            <Input
              ref={inputRef}
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(''); // Clear error on typing
              }}
              onKeyDown={handleKeyDown}
              className="h-14 text-lg"
              disabled={isUnlocking}
              autoFocus
            />
            {error && (
              <p className="text-sm text-destructive font-medium">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full h-14 text-lg font-semibold"
              size="lg"
              disabled={isUnlocking}
            >
              {isUnlocking ? 'Unlocking...' : 'Unlock'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
