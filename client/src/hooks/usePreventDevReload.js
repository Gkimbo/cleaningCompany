import { useEffect } from "react";
import { Platform } from "react-native";

/**
 * usePreventDevReload - Prevents Expo/Metro dev server reload shortcut ("r" key)
 * from triggering when form inputs are focused.
 *
 * This is needed because on web, pressing "r" triggers a full app reload,
 * which is problematic when users are typing in form fields (especially passwords).
 *
 * Usage: Call this hook once at the app root level (e.g., in App.js)
 */
export const usePreventDevReload = () => {
  useEffect(() => {
    // Only apply on web platform where Expo dev shortcuts are active
    if (Platform.OS !== "web") return;

    const handleKeyDown = (event) => {
      // Check if an input element is focused
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.isContentEditable ||
          activeElement.getAttribute("role") === "textbox");

      // If an input is focused and "r" or "R" is pressed (without Cmd/Ctrl)
      if (isInputFocused && (event.key === "r" || event.key === "R")) {
        if (!event.metaKey && !event.ctrlKey) {
          // Stop the event from reaching Expo/Metro dev server handlers
          event.stopPropagation();
        }
      }
    };

    // Use capture phase to intercept before Expo/Metro handlers
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);
};

export default usePreventDevReload;
