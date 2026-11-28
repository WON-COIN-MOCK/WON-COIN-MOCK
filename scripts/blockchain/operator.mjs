import {
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  linkSync,
  unlinkSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import password from "@inquirer/password";
import {
  Wallet,
  Transaction,
  getAddress,
  encryptKeystoreJson,
  decryptKeystoreJson,
} from "ethers";

function fail(message) {
  const e = new Error(message);
  e.name = "OperatorError";
  throw e;
}
const root = fileURLToPath(new URL("../../", import.meta.url));
const dir = join(root, ".secrets");
const target = join(dir, "sepolia-operator.v3.json");
const legacy = join(dir, "sepolia-operator.dpapi.json");
function json(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}
function checkAddress(wallet, expected) {
  if (expected && wallet.address !== getAddress(expected))
    fail("Operator address mismatch.");
}
export function fromLegacy(source) {
  if (process.platform !== "win32")
    fail("Migrate on the original Windows profile first.");
  const old = json(source);
  if (
    old.chainId !== "11155111" ||
    old.protection !== "Windows-DPAPI-CurrentUser" ||
    old.purpose !== "sepolia-test-only-operator"
  )
    fail("Unexpected legacy metadata.");
  // 기본 Windows PowerShell을 사용해 터미널별 PATH와 PowerShell 7 설치 여부에 의존하지 않는다.
  const shell = join(
    process.env.SystemRoot,
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const script = `$ErrorActionPreference = 'Stop'
try {
  [void][Reflection.Assembly]::Load('System.Security, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a')
  $blob = [Convert]::FromBase64String([Console]::In.ReadToEnd())
  $key = [Security.Cryptography.ProtectedData]::Unprotect($blob, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  try { [Console]::OpenStandardOutput().Write($key, 0, $key.Length) }
  finally { [Array]::Clear($key, 0, $key.Length) }
} catch [FormatException] { exit 21 }
  catch [Security.Cryptography.CryptographicException] { exit 22 }
  catch { exit 23 }`;
  const result = spawnSync(
    shell,
    [
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      Buffer.from(script, "utf16le").toString("base64"),
    ],
    {
      input: Buffer.from(old.encryptedKey),
      windowsHide: true,
      timeout: 15000,
    },
  );
  try {
    if (result.error)
      fail("Cannot start or complete Windows PowerShell for DPAPI migration.");
    if (result.status === 21)
      fail("Invalid DPAPI file encoding. Check the original encrypted backup.");
    if (result.status === 22)
      fail(
        "Windows cannot unlock this DPAPI file. Use the original Windows user profile and intact encrypted backup.",
      );
    if (result.status !== 0 || result.stdout?.length !== 32)
      fail("Windows DPAPI helper did not return a valid key.");
    const wallet = new Wallet(result.stdout.toString("hex"));
    checkAddress(wallet, old.address);
    return wallet;
  } finally {
    result.stdout?.fill(0);
  }
}
export async function seal(wallet, pass) {
  const encoded = await encryptKeystoreJson(
    { address: wallet.address, privateKey: wallet.privateKey },
    pass,
  );
  checkAddress(await unlock(encoded, pass), wallet.address);
  return encoded;
}
export async function unlock(encoded, pass) {
  if (JSON.parse(encoded).version !== 3) fail("Expected Ethereum V3 keystore.");
  return new Wallet((await decryptKeystoreJson(encoded, pass)).privateKey);
}
export async function sign(wallet, input) {
  if (
    String(input.chainId) !== "11155111" ||
    input.type !== 2 ||
    !input.to ||
    input.signature ||
    input.from
  )
    fail("Expected unsigned Sepolia type-2 transaction with a recipient.");
  for (const field of [
    "nonce",
    "gasLimit",
    "maxFeePerGas",
    "maxPriorityFeePerGas",
    "value",
    "data",
  ])
    if (input[field] == null) fail("Incomplete transaction.");
  const tx = Transaction.from(input);
  const raw = await wallet.signTransaction(tx);
  if (Transaction.from(raw).from !== wallet.address)
    fail("Signer recovery failed.");
  return raw;
}
export async function run() {
  const env = join(root, ".env");
  if (existsSync(env)) process.loadEnvFile(env);
  const [action = "account", file, ...extra] = process.argv.slice(2);
  if (
    extra.length ||
    !((action === "account" && !file) || (action === "sign" && file))
  )
    fail("Usage: pnpm ct:account or pnpm ct:sign <unsigned.json>");
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    fail("Run in an interactive terminal for hidden password input.");
  const existing = existsSync(target);
  if (action === "sign" && !existing)
    fail("Prepare the V3 operator keystore first.");
  const pass = await password({
    message: existing ? "Keystore password" : "New V3 keystore password",
  });
  let wallet;
  if (existing) wallet = await unlock(readFileSync(target, "utf8"), pass);
  else {
    if (
      pass.length < 12 ||
      pass !==
        (await password({ message: "Confirm password (12+ characters)" }))
    )
      fail("Password too short or confirmation mismatch.");
    wallet = existsSync(legacy) ? fromLegacy(legacy) : Wallet.createRandom();
    checkAddress(wallet, process.env.BLOCKCHAIN_OPERATOR_ADDRESS);
    const encoded = await seal(wallet, pass);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const temp = join(dir, randomUUID() + ".tmp");
    writeFileSync(temp, encoded, { flag: "wx", mode: 0o600 });
    try {
      linkSync(temp, target);
    } finally {
      unlinkSync(temp);
    }
  }
  checkAddress(wallet, process.env.BLOCKCHAIN_OPERATOR_ADDRESS);
  console.log("Verified V3 operator:", wallet.address);
  if (action === "sign") {
    const tx = json(resolve(file));
    console.log("Review Sepolia transaction:", JSON.stringify(tx));
    if (
      (await password({
        message: "Type SIGN to confirm the transaction above",
      })) !== "SIGN"
    )
      fail("Cancelled.");
    const raw = await sign(wallet, tx);
    const output = join(dir, "signed-" + Transaction.from(raw).hash + ".txt");
    writeFileSync(output, raw, { flag: "wx", mode: 0o600 });
    console.log("Signed offline:", output);
  }
}
