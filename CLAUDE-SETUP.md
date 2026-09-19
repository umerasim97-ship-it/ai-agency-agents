# Using This Roster With Claude

Short answer: **yes, these agents work with Claude as-is.** Every agent file
already ships with the YAML frontmatter Claude Code expects (`name`,
`description`, `color`), so it's a copy — not a conversion.

There are three ways to use them, depending on which Claude you have.

---

## Option 1 — Claude Code (recommended, full "subagent" behavior)

Claude Code is Anthropic's terminal/IDE agent. It reads subagents from a
`agents/` folder and can delegate work to them.

```bash
cd /path/to/ai-agency-agents

./install-claude.sh              # install for every project (~/.claude/agents)
./install-claude.sh --project    # install only into this repo (./.claude/agents)
./install-claude.sh --dry-run    # preview, write nothing
./install-claude.sh --list       # show the roster + frontmatter check
```

Manual equivalent, if you'd rather not use the script:

```bash
mkdir -p ~/.claude/agents
cp */*.md ~/.claude/agents/
```

Then:

1. Restart Claude Code.
2. Run `/agents` — you should see 56 agents (engineering, design, marketing,
   product, project-management, spatial-computing, specialized, support, testing).
3. Talk to them normally:

```
Use the Frontend Developer agent to build a responsive pricing page.
Use the Backend Architect agent to design the schema for a booking system.
Use the Growth Hacker agent to plan a launch for my SaaS.
```

You can also reference one explicitly with `@`:

```
@engineering-backend-architect.md review this API design
```

> Files are flattened into a single folder on install because that's the layout
> Claude Code scans. Names stay unique since each file is prefixed with its
> division (e.g. `engineering-frontend-developer.md`).

---

## Option 2 — Claude.ai (Projects)

No subagents there, but Projects let you attach the same files as context.

1. Create a Project.
2. Open **Project knowledge** → upload the 1–3 agent `.md` files you care about.
3. In **Project instructions**, add one line, e.g.
   `Adopt the Frontend Developer persona from the attached file for all replies.`

One project per persona works best — mixing 50 agents in one project dilutes
the persona and eats context.

---

## Option 3 — Claude API / any other LLM tool

The files are plain markdown prompts. Use the body (everything after the
frontmatter) as a system prompt:

```python
# pip install anthropic
from anthropic import Anthropic
import re, pathlib

raw = pathlib.Path("engineering/engineering-backend-architect.md").read_text()
system_prompt = re.sub(r"^---\n.*?\n---\n", "", raw, flags=re.S)  # drop frontmatter

client = Anthropic()
resp = client.messages.create(
    model="claude-sonnet-4-5",          # pick whichever model you have access to
    max_tokens=4096,
    system=system_prompt,
    messages=[{"role": "user", "content": "Design a schema for a booking system."}],
)
print(resp.content[0].text)
```

The same trick works anywhere a system prompt is accepted: Cursor rules,
OpenAI Assistants, Gemini Gems, Ollama, etc. Nothing here is Anthropic-specific —
only Option 1's folder layout is.

---

## Can I do this on the free plan?

Partly — and it depends on which "Claude" you mean.

| What | Free? | Note |
|---|---|---|
| Claude chat (claude.ai, no card needed) | ✅ | Sonnet-class model, web search, file uploads, Projects, Artifacts |
| Free usage cap | ⚠️ | Roughly 15–40 messages per rolling 5-hour window |
| Claude Code (the terminal subagent tool) | ❌ | Requires Pro ($20/mo) or API credits |

So on the free plan:

- **Option 1 (Claude Code) does not work** — the free tier doesn't include it,
  no matter what you paste into the folder.
- **Option 2 (Claude.ai Projects) works.** Create a Project, upload the one or
  two agent `.md` files you need, and add:
  `Adopt the Frontend Developer persona from the attached file.`
  This is the realistic free path for this repo.
- **Option 3 (API) is not free** beyond the one-time starter credit new Console
  accounts get (~$5), but it does unlock Claude Code until that credit is spent.

### Legitimately free routes to *Claude Code* specifically

1. **Anthropic Console starter credit** — new accounts get a small one-time
   credit; point Claude Code at your API key. Good for evaluating, not for
   daily work.
2. **Claude for Open Source** — maintainers/contributors on qualifying projects
   can get six months of the top-tier plan free. Check the current terms;
   it has been expanded/closed at different times.
3. **Point Claude Code at a different model** — it reads `ANTHROPIC_BASE_URL`,
   so you can route it to OpenRouter or a local Ollama model. You get the
   Claude Code *workflow*, but not Claude underneath.
4. **Use a free agent CLI instead** — OpenCode (free, open source, bring your
   own key), Google Antigravity (real free tier), Codex CLI and Grok Build
   (limited free usage). The agents in this repo are plain markdown, so they
   work in any of these.

> Bottom line: the personas are free to use anywhere. Claude *Code* itself is
> the paid part.

---

## What is *not* an agent

`strategy/**` (playbooks, runbooks, `nexus-strategy.md`, `EXECUTIVE-BRIEF.md`)
are planning documents, not personas. They have no `name:`/`description:`
frontmatter and won't appear as subagents. Paste the relevant one into a
session when you want the multi-phase / multi-agent workflow.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Agent doesn't show in `/agents` | Confirm the file is directly inside `~/.claude/agents/`, and that line 1 is `---`. |
| Frontmatter check prints `MISSING FRONTMATTER` | The file was edited and lost its header — restore `name:` and `description:`. |
| Claude ignores the persona | Name the agent explicitly in your prompt ("as the Backend Architect agent…"). |
| Too many agents, replies feel generic | Install only the divisions you use: `cp engineering/*.md ~/.claude/agents/`. |
| On the free plan, `/agents` isn't there | Expected — Claude Code needs Pro or API credits. Use Claude.ai Projects (Option 2) instead. |
