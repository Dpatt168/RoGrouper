"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

const HEARTBEAT_INTERVAL = 60 * 1000; // 1 minute

export function useActivityHeartbeat() {
  const { status } = useSession();
  const pathname = usePathname();
  const lastHeartbeat = useRef<number>(0);

  useEffect(() => {
    if (status !== "authenticated") return;

    const sendHeartbeat = async () => {
      // Don't send more than once per minute
      if (Date.now() - lastHeartbeat.current < HEARTBEAT_INTERVAL) return;
      
      lastHeartbeat.current = Date.now();
      
      // Determine current page name from pathname
      let currentPage = "Dashboard";
      if (pathname.includes("/admin")) {
        currentPage = "Admin Panel";
      } else if (pathname.includes("/api-docs")) {
        currentPage = "API Docs";
      }

      try {
        await fetch("/api/admin/active-users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPage }),
        });
      } catch {
        // Silently fail - this is just for tracking
      }
    };

    // Send initial heartbeat
    sendHeartbeat();

    // Set up interval for periodic heartbeats
    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Also send heartbeat on visibility change (when user returns to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [status, pathname]);
}
