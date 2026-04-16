export function buildExtractionPrompt(content: string): string {
  return `Extract actionable tasks from the following text.

For each task return:
- title: clear, actionable, starts with a verb
- description: optional extra context (null if none)
- durationMins: integer estimate in minutes (null if unknown)
- deadline: ISO date string if deadline mentioned (null if none)
- priority: 1=urgent, 2=high, 3=normal, 4=low (default 3)
- tags: string labels like "email", "health", "meetings" — never project names

Only include clearly actionable items. Ignore vague ideas or observations.

Text:
${content}`;
}
