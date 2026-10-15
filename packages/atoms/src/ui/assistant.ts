/**
 * Master Assistant panel UI state (per browser)
 */

import { createAtomWithStorage, namedAtom } from "../utils/atom-helpers";

/** Default width of the assistant panel, as a percentage of the view */
export const ASSISTANT_PANEL_WIDTH_DEFAULT = 50;

/** Whether the assistant panel is shown when no task is open */
export const showAssistantPanelAtom = namedAtom(
  "showAssistantPanelAtom",
  createAtomWithStorage<boolean>("show-assistant-panel", true),
);

/** Assistant panel width (percentage), kept separate from the task panel's width */
export const assistantPanelWidthAtom = namedAtom(
  "assistantPanelWidthAtom",
  createAtomWithStorage<number>(
    "assistant-panel-width",
    ASSISTANT_PANEL_WIDTH_DEFAULT,
  ),
);
