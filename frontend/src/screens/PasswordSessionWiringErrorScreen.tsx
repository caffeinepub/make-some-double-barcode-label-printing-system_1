export default function PasswordSessionWiringErrorScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Configuration Error</h1>
          <p className="text-lg text-muted-foreground">
            The password session system is not properly configured.
          </p>
        </div>
        
        <div className="bg-muted/50 border border-border rounded-lg p-6 text-left space-y-3">
          <h2 className="font-semibold text-foreground">What you can do:</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Try refreshing the page</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Clear your browser cache and reload</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Contact support if the problem persists</span>
            </li>
          </ul>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
}
