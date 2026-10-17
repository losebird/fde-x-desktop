export async function runBriefing(_deps, input) {
  if (input && input.mode === 'full') {
    throw Object.assign(new Error('briefing generation failed'), { code: 'BRIEFING_TEST_THROW' })
  }
  return { briefingId: '', briefing: null }
}

export function mergeBriefingSubmit() {
  return { ok: false, error: 'unused' }
}
