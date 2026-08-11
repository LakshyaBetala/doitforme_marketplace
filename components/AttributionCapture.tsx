"use client";

import { useEffect } from "react";
import { captureFirstTouch } from "@/lib/attribution";

/**
 * Records first-touch referrer/UTM into localStorage on first load, so that by
 * the time the user reaches onboarding we still know where they came from.
 * Renders nothing. Mounted once, globally, in app/layout.tsx.
 */
export default function AttributionCapture() {
  useEffect(() => {
    captureFirstTouch();
  }, []);

  return null;
}
