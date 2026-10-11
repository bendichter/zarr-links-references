#!/usr/bin/env node
import { readdir } from "fs/promises";
import { join, extname } from "path";
import { execSync } from "child_process";

const examplesDir = "examples";
const invalidDir = "invalid";
const schemaFile = "schema.json";

async function runTests() {
  console.log("🧪 Running validation tests...\n");

  try {
    const files = await readdir(examplesDir);
    const jsonFiles = files.filter((file) => extname(file) === ".json");

    if (jsonFiles.length === 0) {
      console.log("⚠️  No JSON files found in examples directory");
      process.exit(1);
    }

    let passed = 0;
    let failed = 0;

    for (const file of jsonFiles) {
      const filePath = join(examplesDir, file);
      process.stdout.write(`Testing ${file}... `);

      try {
        execSync(`node validate.js ${schemaFile} ${filePath}`, {
          stdio: "pipe",
          encoding: "utf8",
        });
        console.log("✅ PASSED");
        passed++;
      } catch (error) {
        console.log("❌ FAILED");
        console.log(error.stdout || error.message);
        failed++;
      }
    }

    // Every file in invalid/ must fail validation
    const invalidFiles = (await readdir(invalidDir)).filter(
      (file) => extname(file) === ".json",
    );
    for (const file of invalidFiles) {
      const filePath = join(invalidDir, file);
      process.stdout.write(`Testing ${filePath} is rejected... `);
      try {
        execSync(`node validate.js ${schemaFile} ${filePath}`, {
          stdio: "pipe",
          encoding: "utf8",
        });
        console.log("❌ FAILED (it validated)");
        failed++;
      } catch {
        console.log("✅ PASSED");
        passed++;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log(
      `Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`,
    );
    console.log("=".repeat(50));

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Error running tests:", error.message);
    process.exit(1);
  }
}

runTests();
