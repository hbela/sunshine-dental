# User Taste
- After merging a feature branch, wants it deleted both locally and on the remote (explicitly requested "delete the feature branch local and remote" right after a merge; later chose "Merge + push, delete branch" again when explicitly offered alternatives including keeping the branch). Confidence: 0.85
- Standard end-of-task flow: merge feature branch into main with a merge commit, push to origin, then delete the branch — treats this as the default completion sequence for a finished unit of work (a bare "let s wrap up now" triggers the whole sequence without further confirmation). Confidence: 0.85
- Gives very terse, lowercase directives ("let s continue") and expects the agent to infer the task from the current IDE selection and conversation context rather than spelling out instructions. Confidence: 0.6
- Reports bugs by pasting raw terminal output/stack traces with minimal framing ("I have an error:" + full log) and expects the agent to diagnose from the dump. Confidence: 0.7
- Develops on Windows with cmd as the shell — Unix commands (`ls`) fail; use `dir`, `findstr`, `netstat`, `set VAR=...` syntax. Confidence: 0.9
- Main project is a pnpm monorepo with an apps/ + packages/ layout and internal packages scoped `@repo/*`; API dev server runs via `tsx watch --env-file=.env` on Node 24. Confidence: 0.8
- Machine has `NODE_ENV=production` set globally in the shell, which makes pnpm skip devDependencies on install — clear NODE_ENV (e.g. `set NODE_ENV=`) when running `pnpm install`. Confidence: 0.8
