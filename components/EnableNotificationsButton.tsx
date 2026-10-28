"use client";

import { useState, useEffect } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";

export default function EnableNotificationsButton() {
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const handleEnableClick = async () => {
    if (!("Notification" in window)) {
      toast.error("Your browser does not support notifications.");
      return;
    }

    if (Notification.permission === "default") {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        toast.success("Notifications enabled!");
      }
    } else if (Notification.permission === "denied") {
      toast("Notifications are currently blocked.", {
        description: "To receive alerts, please click the lock icon next to the URL bar in your browser and allow notifications.",
        duration: 8000,
      });
    }
  };

  if (permission === "granted") return null;

  return (
    <button
      onClick={handleEnableClick}
      className="flex min-h-[44px] w-full items-center gap-3 rounded-[9px] px-3 text-left text-[13px] font-semibold text-[var(--fg)] hover:bg-[var(--chip)] transition-colors"
    >
      <BellRing size={16} className="shrink-0 text-[var(--fg-muted)]" />
      Turn on alerts
    </button>
  );
}
