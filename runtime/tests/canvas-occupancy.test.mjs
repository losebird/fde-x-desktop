import './support/no-stray-processes.mjs'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { landKindFromTab, occupancyAction } from '../canvas-occupancy.mjs'
import { seamOfKind, surfaceOfKind } from '../host-catalog.mjs'

test('conversation occupancy keeps chat and trajectory, denies other views', () => {
  assert.equal(occupancyAction({ name: 'conversation.view', id: 'chat' }), 'allow')
  assert.equal(occupancyAction({ name: 'conversation.view', id: 'trajectory' }), 'allow')
  assert.equal(occupancyAction({ name: 'conversation.view', id: 'semantic' }), 'deny')
  assert.equal(occupancyAction({ name: 'conversation.view', id: 'semantic-os' }), 'deny')
})

test('catalog chrome is denied or emptied so DSH fallback does not paint', () => {
  assert.equal(occupancyAction({ name: 'sidebar' }), 'deny')
  assert.equal(occupancyAction({ name: 'sidebar.workspaces' }), 'deny')
  assert.equal(occupancyAction({ name: 'rightbar' }), 'deny')
  assert.equal(occupancyAction({ name: 'rightbar.session' }), 'deny')
  assert.equal(occupancyAction({ name: 'sidebar.right.pane.tab', key: '@deepseek-ai/dsh-client-ui-sidebar-files' }), 'deny')
  assert.equal(occupancyAction({ name: 'conversation.session.header.actions' }), 'allow')
  assert.equal(occupancyAction({ name: 'conversation.session.header.actions', id: 'rightbar' }), 'deny')
  assert.equal(occupancyAction({ name: 'conversation.session.header.actions', id: '@deepseek-ai/dsh-experimental-client-ui-agent-team' }), 'deny')
  assert.equal(occupancyAction({ name: 'conversation.session.header.corner' }), 'deny')
  assert.equal(occupancyAction({ name: 'conversation.hero.workspace' }), 'empty')
  assert.equal(occupancyAction({ name: 'conversation.hero.brand.mark' }), 'empty')
  assert.equal(occupancyAction({ name: 'conversation.hero.agentPreset' }), 'allow')
})

test('composer and session conversation slots stay allowed', () => {
  assert.equal(occupancyAction({ name: 'conversation.session' }), 'allow')
  assert.equal(occupancyAction({ name: 'conversation.session.header.actions' }), 'allow')
  assert.equal(occupancyAction({ name: 'conversation.hero.agentPreset' }), 'allow')
})

test('lan-assist face slots stay off the session canvas', () => {
  assert.equal(occupancyAction({ name: 'conversation.input.dock' }), 'deny')
  assert.equal(occupancyAction({ name: 'conversation.input.dock', id: 'lan-assist-dock' }), 'deny')
  assert.equal(occupancyAction({ name: 'shell.overlay', id: 'lan-assist-chat' }), 'deny')
  assert.equal(occupancyAction({ name: 'conversation.input.left', id: 'lan-assist-ask' }), 'deny')
})

test('core patch disables Host catalog column plugins', () => {
  const patch = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'dsh-core.patch.yml'), 'utf8')
  for (const id of [
    'ui-sidebar-files',
    'ui-plan',
    'ui-goal',
    'ui-jobs',
    'ui-schedule',
    'ui-skill',
    'ui-deliverables',
    'ui-agent-team',
  ]) {
    assert.match(patch, new RegExp(`- id: ${id}\\n  disabled: true`))
  }
})

test('tab kinds land on host-catalog surfaces, terminal stays on the AI page', () => {
  assert.equal(landKindFromTab('@deepseek-ai/dsh-client-ui-sidebar-files'), 'file')
  assert.equal(landKindFromTab('officeToPdf'), 'skill')
  assert.equal(landKindFromTab('ui-agent-team'), 'session')
  assert.equal(surfaceOfKind('file').href.panel, 'files')
  assert.equal(surfaceOfKind('officeToPdf').href.panel, 'skills')
  assert.equal(surfaceOfKind('goal').href.panel, 'plan')
  assert.equal(surfaceOfKind('terminal').href.panel, 'ai')
  assert.equal(surfaceOfKind('terminal').href.accessory, 'terminal')
  assert.equal(seamOfKind('terminal'), 'session')
})
