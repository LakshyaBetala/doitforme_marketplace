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
      className="w-full flex items-center px-4 py-3 hover:bg-blue-500/10 text-sm text-zinc-300 hover:text-blue-400 transition-colors text-left"
    >
      <BellRing size={16} className="mr-3 shrink-0 text-blue-400" />
      <div className="flex flex-col">
        <span className="font-medium text-white">Enable Alerts</span>
        <span className="text-[10px] text-zinc-500">Get push notifications</span>
      </div>
    </button>
  );
}
