import { HostId, SkillMetadata } from '../../../core/dist/index.js';
import { ResolvedSkill } from '../types.js';
export interface LogicalSkillGroup {
    normalizedName: string;
    primarySkill: SkillMetadata;
    installations: Map<HostId, SkillMetadata>;
}
export declare class SkillDeduplicator {
    private groups;
    constructor(skills?: SkillMetadata[]);
    indexSkills(skills: SkillMetadata[]): void;
    getLogicalSkills(): SkillMetadata[];
    resolveSkillForHost(skill: SkillMetadata, targetHost: HostId): ResolvedSkill;
    getInstallations(skillName: string): SkillMetadata[];
}
//# sourceMappingURL=deduplicator.d.ts.map