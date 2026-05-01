const FOCUS_EDITOR_GROUP_COMMANDS = [
  "workbench.action.focusFirstEditorGroup",
  "workbench.action.focusSecondEditorGroup",
  "workbench.action.focusThirdEditorGroup",
  "workbench.action.focusFourthEditorGroup",
  "workbench.action.focusFifthEditorGroup",
  "workbench.action.focusSixthEditorGroup",
  "workbench.action.focusSeventhEditorGroup",
  "workbench.action.focusEighthEditorGroup"
] as const;

const OPEN_EDITOR_AT_INDEX_COMMANDS = [
  "workbench.action.openEditorAtIndex1",
  "workbench.action.openEditorAtIndex2",
  "workbench.action.openEditorAtIndex3",
  "workbench.action.openEditorAtIndex4",
  "workbench.action.openEditorAtIndex5",
  "workbench.action.openEditorAtIndex6",
  "workbench.action.openEditorAtIndex7",
  "workbench.action.openEditorAtIndex8",
  "workbench.action.openEditorAtIndex9"
] as const;

const NEXT_EDITOR_IN_GROUP_COMMANDS = [
  "workbench.action.nextEditorInGroup"
] as const;

const PREVIOUS_EDITOR_IN_GROUP_COMMANDS = [
  "workbench.action.previousEditorInGroup"
] as const;

export function findEditorGroupFocusCommand(commands: Iterable<string>, groupIndex: number): string | undefined {
  const command = FOCUS_EDITOR_GROUP_COMMANDS[groupIndex];
  return command && toCommandSet(commands).has(command) ? command : undefined;
}

export function findOpenEditorAtIndexCommand(commands: Iterable<string>, tabIndex: number): string | undefined {
  const command = OPEN_EDITOR_AT_INDEX_COMMANDS[tabIndex];
  return command && toCommandSet(commands).has(command) ? command : undefined;
}

export function findNextEditorInGroupCommand(commands: Iterable<string>): string | undefined {
  return findSupportedCommand(commands, NEXT_EDITOR_IN_GROUP_COMMANDS);
}

export function findPreviousEditorInGroupCommand(commands: Iterable<string>): string | undefined {
  return findSupportedCommand(commands, PREVIOUS_EDITOR_IN_GROUP_COMMANDS);
}

function toCommandSet(commands: Iterable<string>): Set<string> {
  return commands instanceof Set ? commands : new Set(commands);
}

function findSupportedCommand(commands: Iterable<string>, candidates: readonly string[]): string | undefined {
  const commandSet = toCommandSet(commands);
  return candidates.find((command) => commandSet.has(command));
}