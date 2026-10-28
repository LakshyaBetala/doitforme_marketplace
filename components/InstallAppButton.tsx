"use client";

import { useState, useEffect } from "react";
import { Download, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";

export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const isPwa = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
    setIsStandalone(isPwa);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    
    // Check if app was installed
    window.addEventListener("appinstalled", () => {
      setIsInstallable(false);
      setIsStandalone(true);
      toast.success("App installed successfully!");
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstallable(false);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      toast("To install the app on iOS:", {
        description: "Tap the Share button at the bottom of Safari, then select 'Add to Home Screen'.",
        duration: 8000,
      });
    } else {
      toast("Your device does not support automatic installation, or the app is already installed.");
    }
  };

  // If already installed, don't show the button
  if (isStandalone) return null;

  return (
    <button
      onClick={handleInstallClick}
      className="flex min-h-[44px] w-full items-center gap-3 rounded-[9px] px-3 text-left text-[13px] font-semibold text-[var(--fg)] hover:bg-[var(--chip)] transition-colors"
    >
      {isIOS ? (
        <MonitorSmartphone size={16} className="shrink-0 text-[var(--fg-muted)]" />
      ) : (
        <Download size={16} className="shrink-0 text-[var(--fg-muted)]" />
      )}
      Install app
    </button>
  );
}
