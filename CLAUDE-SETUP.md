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
