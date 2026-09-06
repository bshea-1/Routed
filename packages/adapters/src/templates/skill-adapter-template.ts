import { HostId } from '../../../core/dist/index.js';

export function generateRouteSkillContent(hostId: HostId, hostName: string): string {
    return `---
name: route
description: Universal local routing layer for Agent Skills. Automatically selects and activates the best installed skills for any coding prompt without external LLM token costs.
aliases: [routed]
---

# /route: Universal Local Skill Router

This environment is integrated with **Routed**, a local routing layer for AI coding tools.

When the user prefixes a prompt with \`/route <prompt>\`, execute the routing workflow:

## Routing Workflow

1. **Query the local Routed CLI engine**:
   Run the following terminal command to obtain the optimal skill routing decision:
   \`\`\`bash
   routed route --json "<USER_PROMPT_HERE>"
   \`\`\`

2. **Evaluate the Routing Decision**:
   - **No Skill Required** (\`isNoSkill: true\` or \`selectedSkills: []\`):
     The prompt is a general task (e.g. simple edit, conversation). Proceed using your standard capabilities without loading extra skills.
   - **Skill(s) Selected**:
     The JSON output contains the ranked \`selectedSkills\`. Each entry provides the skill \`name\`, \`description\`, and filesystem \`path\`. When multiple skills are returned (e.g. for multi-task or compound prompts), all returned skills are relevant and should be activated.

3. **Activate Selected Skill(s)**:
   - Read the \`SKILL.md\` file located at each selected skill's \`path\` in \`selectedSkills\`.
   - Combine and adopt the guidelines, patterns, and workflows specified across all loaded skills.

4. **Execute User Request**:
   - Fulfill the user's original request strictly following the combined instructions from all activated skills.

---
*Routed Local Core Engine - Zero Paid Routing Tokens - Privacy-First Local Execution*
`;
}
