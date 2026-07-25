import { runDoctor } from './doctor/doctor.mjs';

const exitCode = await runDoctor();
process.exitCode = exitCode;
