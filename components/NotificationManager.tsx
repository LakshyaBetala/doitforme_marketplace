"use client";

import { useEffect } from "react";

export default function NotificationManager() {
    useEffect(() => {
        const requestPermission = async () => {
            if (!("Notification" in window)) {
                console.log("This browser does not support desktop notification");
                return;
            }

            if (Notification.permission === "default") {
                try {
                    // Request permission on mount (as requested: "sign up or open the website")
                    // We could delay this or tie it to an interaction, but satisfying the prompt directly.
                    const permission = await Notification.requestPermission();
                    console.log("Notification permission:", permission);
                } catch (error) {
                    console.error("Error requesting notification permission:", error);
                }
            }
        };

        requestPermission();
    }, []);

    return null; // Headless component
}
