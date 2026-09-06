import { DoctorReport } from '../../../core/dist/index.js';
export interface DoctorCommandOptions {
    fix?: boolean;
    json?: boolean;
}
export declare function runDoctorCommand(options?: DoctorCommandOptions): Promise<DoctorReport>;
//# sourceMappingURL=doctor.d.ts.map