import { RouteOptions, RouteResult, SkillMetadata } from '../types.js';
export declare class LexicalRouter {
    private bm25;
    private skills;
    constructor(skills?: SkillMetadata[]);
    updateSkills(skills: SkillMetadata[]): void;
    route(query: string, options?: RouteOptions): RouteResult;
}
//# sourceMappingURL=lexical-router.d.ts.map