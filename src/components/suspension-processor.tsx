"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

// This component runs in the background and processes expired suspensions every minute
export function SuspensionProcessor() {
  const { data: session } = useSession();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only run if user is logged in
    if (!session?.user?.robloxId) {
      return;
    }

    // Function to process expired suspensions
    const processExpiredSuspensions = async () => {
      try {
        const response = await fetch("/api/cron/process-suspensions", {
          method: "POST",
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.restoredCount > 0) {
            console.log(`[SuspensionProcessor] Restored ${data.restoredCount} users from suspension`);
          }
        }
      } catch (error) {
        // Silently fail - this is a background task
        console.error("[SuspensionProcessor] Error:", error);
      }
    };

    // Run immediately on mount
    processExpiredSuspensions();

    // Then run every 60 seconds
    intervalRef.current = setInterval(processExpiredSuspensions, 60000);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [session?.user?.robloxId]);

  // This component doesn't render anything
  return null;
}
