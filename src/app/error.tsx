"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
      <div className="max-w-md w-full space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>حدث خطأ غير متوقع</AlertTitle>
          <AlertDescription>
            نعتذر عن هذا الخلل. تم تسجيل الخطأ، يمكنك المحاولة مرة أخرى.
          </AlertDescription>
        </Alert>
        <Button onClick={reset} className="w-full">
          <RotateCcw className="ml-2 h-4 w-4" />
          إعادة المحاولة
        </Button>
      </div>
    </div>
  );
}
