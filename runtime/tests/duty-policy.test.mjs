import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BIZ_PRESET, SCHEDULER_PRESET, dutyPresetForWorkflowSteps, isDutyPickerPreset } from '../duty-policy.mjs'

test('duty picker drops the retired workflow preset', () => {
  assert.equal(isDutyPickerPreset('standard'), true)
  assert.equal(isDutyPickerPreset('fde-biz'), true)
  assert.equal(isDutyPickerPreset('fde-workflow'), false)
  assert.equal(isDutyPickerPreset(''), false)
})

test('workflow steps with biz source or biz tools use fde-biz', () => {
  assert.equal(dutyPresetForWorkflowSteps([{ config: { prompt: 'pong' } }]), SCHEDULER_PRESET)
  assert.equal(dutyPresetForWorkflowSteps([{ config: { presetId: 'fde-workflow', prompt: 'pong' } }]), SCHEDULER_PRESET)
  assert.equal(dutyPresetForWorkflowSteps([{
    config: { sourceRef: 'biz:expense:EXP1', prompt: '改差旅' },
  }]), BIZ_PRESET)
  assert.equal(dutyPresetForWorkflowSteps([{
    config: { tools: ['biz_preview', 'fde_submit_result'], prompt: '改差旅' },
  }]), BIZ_PRESET)
})
