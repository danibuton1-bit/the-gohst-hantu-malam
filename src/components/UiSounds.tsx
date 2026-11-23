import { useEffect } from "react";
import { audio } from "@/lib/audio";

/** Plays a click sound for every button, link and tappable control in the app. */
export function UiSounds() {
  useEffect(() => {
    const on = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest("button, a, [role=button], [role=tab], [role=option], [role=switch], [role=checkbox], label, select");
      if (!el || (el as HTMLButtonElement).disabled || el.closest("[data-no-click-sound]")) return;
      audio.click();
    };
    document.addEventListener("pointerdown", on, true);
    return () => document.removeEventListener("pointerdown", on, true);
  }, []);
  return null;
}
