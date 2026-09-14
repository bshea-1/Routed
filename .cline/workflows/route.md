---
description: Universal local skill routing via Routed. Matches prompts to the best Agent Skills with zero LLM context tokens.
---

# Route Skill Workflow

When this workflow is executed or when the user invokes `/route <prompt>`:

1. **Route the Prompt**:
   - Use the `route_skill` tool from the `routed` MCP server with the user's prompt as the `prompt` argument, or run:
     ```bash
     routed route --json "<USER_PROMPT>"
     ```

2. **Check Matching Skills**:
   - If no skills are needed (`isNoSkill: true` or `selectedSkills` is empty), proceed with standard task execution without extra overhead.
   - If one or more skills are returned in `selectedSkills`, fetch and read the `SKILL.md` instructions at each skill's `path` (or call `get_skill`).

3. **Execute Task with Skills**:
   - Apply the rules, workflows, and constraints described in the loaded skills to solve the user's request accurately.
