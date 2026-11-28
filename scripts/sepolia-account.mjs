import { run } from "./blockchain/operator.mjs";
run().catch((error) => {
  console.error(
    error.name === "OperatorError"
      ? error.message
      : "Operation failed. Check the file, permissions and password.",
  );
  process.exitCode = 1;
});
