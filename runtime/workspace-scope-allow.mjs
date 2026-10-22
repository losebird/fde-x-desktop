export const workspaceScopeAllow = [
  {
    file: 'runtime/plan/workflow-run.mjs',
    table: 'workflow_runs',
    reason: 'workflow_runs 没有 workspace_id 列。POST /api/v1/plan/workflows/:id/run 先走 startWorkflowRun，别的工作区的工作流在插入 run 之前就是 404。之后按 run id 改状态的语句没有另一条 HTTP 口。启动时 failInterruptedRuns 收的是本进程里所有未完成的 run。',
  },
]
