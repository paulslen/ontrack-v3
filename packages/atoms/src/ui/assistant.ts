/**
 * Master Assistant panel UI state (per browser)
 */

import { atom } from "jotai";
import { createAtomWithStorage, namedAtom } from "../utils/atom-helpers";

/** Default width of the assistant panel, as a percentage of the view */
export const ASSISTANT_PANEL_WIDTH_DEFAULT = 50;

/** Whether the assistant panel is shown when no task is open */
export const showAssistantPanelAtom = namedAtom(
  "showAssistantPanelAtom",
  createAtomWithStorage<boolean>("show-assistant-panel", true),
);

/**
 * Whether the assistant sheet is open on mobile. Not persisted: unlike the desktop panel,
 * the full-height sheet should only appear when the user asks for it.
 */
export const mobileAssistantOpenAtom = namedAtom(
  "mobileAssistantOpenAtom",
  atom<boolean>(false),
);

/** Assistant panel width (percentage), kept separate from the task panel's width */
export const assistantPanelWidthAtom = namedAtom(
  "assistantPanelWidthAtom",
  createAtomWithStorage<number>(
    "assistant-panel-width",
    ASSISTANT_PANEL_WIDTH_DEFAULT,
  ),
);
