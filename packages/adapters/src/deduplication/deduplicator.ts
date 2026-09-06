import { HostId, SkillMetadata } from '@routed/core';
import { ResolvedSkill } from '../types.js';
export interface LogicalSkillGroup {
    normalizedName: string;
    primarySkill: SkillMetadata;
    installations: Map<HostId, SkillMetadata>;
}
export class SkillDeduplicator {
    private groups = new Map<string, LogicalSkillGroup>();
    constructor(skills: SkillMetadata[] = []) {
        if (skills.length > 0) {
            this.indexSkills(skills);
        }
    }
    public indexSkills(skills: SkillMetadata[]): void {
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
    public getLogicalSkills(): SkillMetadata[] {
        return Array.from(this.groups.values()).map((g) => g.primarySkill);
    }
    public resolveSkillForHost(skill: SkillMetadata, targetHost: HostId): ResolvedSkill {
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
    public getInstallations(skillName: string): SkillMetadata[] {
        const key = skillName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const group = this.groups.get(key);
        return group ? Array.from(group.installations.values()) : [];
    }
}
