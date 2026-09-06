export class SkillDeduplicator {
    groups = new Map();
    constructor(skills = []) {
        if (skills.length > 0) {
            this.indexSkills(skills);
        }
    }
    indexSkills(skills) {
        this.groups.clear();
        for (const skill of skills) {
            const key = skill.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            let group = this.groups.get(key);
            if (!group) {
                group = {
                    normalizedName: key,
                    primarySkill: skill,
                    installations: new Map(),
                };
                this.groups.set(key, group);
            }
            group.installations.set(skill.sourceHost, skill);
        }
    }
    getLogicalSkills() {
        return Array.from(this.groups.values()).map((g) => g.primarySkill);
    }
    resolveSkillForHost(skill, targetHost) {
        const key = skill.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const group = this.groups.get(key);
        if (group) {
            const nativeCopy = group.installations.get(targetHost);
            if (nativeCopy) {
                return {
                    logicalSkill: nativeCopy,
                    targetPath: nativeCopy.path,
                    isNativeToHost: true,
                    originalHost: nativeCopy.sourceHost,
                };
            }
            const anyCopy = group.primarySkill;
            return {
                logicalSkill: anyCopy,
                targetPath: anyCopy.path,
                isNativeToHost: false,
                originalHost: anyCopy.sourceHost,
            };
        }
        return {
            logicalSkill: skill,
            targetPath: skill.path,
            isNativeToHost: skill.sourceHost === targetHost,
            originalHost: skill.sourceHost,
        };
    }
    getInstallations(skillName) {
        const key = skillName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const group = this.groups.get(key);
        return group ? Array.from(group.installations.values()) : [];
    }
}
//# sourceMappingURL=deduplicator.js.map