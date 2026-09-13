#!/usr/bin/env node
/**
 * Seeds demo users into D1.
 *
 * Usage: node scripts/seed.js --local      (default)
 *        node scripts/seed.js --remote
 *
 * The old Mongo seed inserted passwords in plaintext, so none of the seeded
 * accounts could ever log in. These are hashed with the same scheme the Worker
 * uses, and the password is printed once so you can actually sign in.
 */
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { webcrypto as crypto } from "node:crypto";
import { hashPassword, sqlString } from "./lib/hash.mjs";

const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? "chatcast-demo-2024";

const people = [
  ["emma.thompson@example.com", "Emma Thompson", "women/1"],
  ["olivia.miller@example.com", "Olivia Miller", "women/2"],
  ["sophia.davis@example.com", "Sophia Davis", "women/3"],
  ["ava.wilson@example.com", "Ava Wilson", "women/4"],
  ["isabella.brown@example.com", "Isabella Brown", "women/5"],
  ["mia.johnson@example.com", "Mia Johnson", "women/6"],
  ["charlotte.williams@example.com", "Charlotte Williams", "women/7"],
  ["james.anderson@example.com", "James Anderson", "men/1"],
  ["william.clark@example.com", "William Clark", "men/2"],
  ["benjamin.taylor@example.com", "Benjamin Taylor", "men/3"],
  ["lucas.moore@example.com", "Lucas Moore", "men/4"],
  ["henry.jackson@example.com", "Henry Jackson", "men/5"],
];

const target = process.argv.includes("--remote") ? "--remote" : "--local";

const statements = [];
const timestamp = new Date().toISOString();

for (const [email, fullName, portrait] of people) {
  const hash = await hashPassword(DEMO_PASSWORD);

  statements.push(
    `INSERT OR IGNORE INTO users (id, email, full_name, password_hash, profile_pic, created_at, updated_at) VALUES (` +
      [
        sqlString(crypto.randomUUID()),
        sqlString(email),
        sqlString(fullName),
        sqlString(hash),
        sqlString(`https://randomuser.me/api/portraits/${portrait}.jpg`),
        sqlString(timestamp),
        sqlString(timestamp),
      ].join(", ") +
      ");",
  );
}

const file = join(mkdtempSync(join(tmpdir(), "chatcast-seed-")), "seed.sql");
writeFileSync(file, statements.join("\n"), "utf8");

// A single command string rather than an args array: Node's DEP0190 warning
// fires only on `execFileSync(cmd, args, { shell: true })`. Every part here is
// either hardcoded or a path this script just created, so there is nothing
// user-controlled to escape — only the temp path needs quoting for spaces.
execSync(`npx wrangler d1 execute chatcast ${target} --file "${file}" --yes`, {
  stdio: "inherit",
});

console.log(`\nSeeded ${people.length} demo users (${target.replace("--", "")}).`);
console.log(`Password for every demo account: ${DEMO_PASSWORD}`);
