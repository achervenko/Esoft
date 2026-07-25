import { runSeed } from "./seed";

runSeed().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});