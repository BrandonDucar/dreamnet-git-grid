#!/usr/bin/env node

import {
  buildIndex,
  createEvent,
  initializeRepository,
  validateRepository,
} from "../lib/git-grid.mjs";

function parseArgs(argv) {
  const [command, target = ".", ...rest] = argv;
  const options = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = value;
    index += 1;
  }

  return { command, target, options };
}

function usage() {
  return `DreamNet GitGrid

Usage:
  git-grid validate [repo]
  git-grid index [repo]
  git-grid init <repo> --repo-id <uri> --object-type <type> --visibility <public|private>
  git-grid event <repo> --event-type <type> --source <uri> --evidence-mode <mode> --payload <file>
`;
}

async function main() {
  const { command, target, options } = parseArgs(process.argv.slice(2));

  switch (command) {
    case "validate": {
      const result = await validateRepository(target);
      console.log(JSON.stringify(result, null, 2));
      if (!result.valid) process.exitCode = 1;
      return;
    }
    case "index": {
      const result = await buildIndex(target);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "init": {
      const result = await initializeRepository(target, {
        repoId: options["repo-id"],
        objectType: options["object-type"],
        visibility: options.visibility,
      });
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "event": {
      const result = await createEvent(target, {
        eventType: options["event-type"],
        sourceRef: options.source,
        evidenceMode: options["evidence-mode"],
        payloadPath: options.payload,
      });
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    default:
      console.error(usage());
      process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
