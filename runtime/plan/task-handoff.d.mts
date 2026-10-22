export function taskHandoffPrompt(
  task: { id?: string; title?: string; sourceRef?: string; notes?: string } | null | undefined,
  note?: string,
): {
  preset: string
  sessionTitle: string
  prompt: string
}
