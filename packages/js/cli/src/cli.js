#!/usr/bin/env node

import { runAppFoundryCli } from "./index.js";

const exitCode = await runAppFoundryCli();
process.exitCode = exitCode;
