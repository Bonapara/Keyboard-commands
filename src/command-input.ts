export function replaceLastCommandToken(input: string, replacement: string): string {
  if (!input) {
    return replacement;
  }

  if (/[^\s,]+$/.test(input)) {
    return input.replace(/([^\s,]+)$/, replacement);
  }

  // Input ends with a separator (e.g. trailing comma) — append instead of
  // replacing, otherwise the dropdown selection would be silently dropped.
  const needsSpace = !/\s$/.test(input);
  return `${input}${needsSpace ? ' ' : ''}${replacement}`;
}

function extractCommandNameFromSuggestion(selectedValue: string): string | null {
  const commandNameMatch = selectedValue.match(/·\s*(\w+)/);
  return commandNameMatch ? commandNameMatch[1] : null;
}

export function applyDropdownSelection(
  originalInput: string,
  selectedValue: string | undefined,
  isKnownCommand: (name: string) => boolean
): string {
  const trimmedInput = originalInput.trim();

  if (!selectedValue || selectedValue === trimmedInput) {
    return trimmedInput;
  }

  // Summary strings describe the chain but are not executable input.
  if (selectedValue.includes('|')) {
    return trimmedInput;
  }

  // Command suggestions use "alias · CommandName -- description".
  if (selectedValue.includes('·')) {
    const extractedCommand = extractCommandNameFromSuggestion(selectedValue);
    if (extractedCommand && isKnownCommand(extractedCommand)) {
      // Pass the un-trimmed input so a trailing separator (e.g. "hf  ") is
      // preserved and the selection is appended instead of overwriting.
      return replaceLastCommandToken(originalInput, extractedCommand).trim();
    }

    return trimmedInput;
  }

  // Binding selections are resolved later from the original typed input.
  if (/[?;]/.test(originalInput)) {
    return trimmedInput;
  }

  return replaceLastCommandToken(originalInput, selectedValue).trim();
}
