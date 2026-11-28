import { existsSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const env = new URL(".env", root);
class SafeError extends Error {}

async function main() {
  if (existsSync(env)) process.loadEnvFile(env);
  const endpoint = process.env.BLOCKCHAIN_RPC_URL;
  if (!endpoint)
    throw new SafeError("BLOCKCHAIN_RPC_URL is missing in local .env");
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw new SafeError("RPC URL is invalid");
  }
  const allowed =
    (url.hostname === "eth-sepolia.g.alchemy.com" &&
      url.pathname.startsWith("/v2/")) ||
    (url.hostname === "sepolia.infura.io" && url.pathname.startsWith("/v3/"));
  if (url.protocol !== "https:" || !allowed || url.username || url.password)
    throw new SafeError("Use an Alchemy or Infura Sepolia HTTPS endpoint");
  if (
    process.env.BLOCKCHAIN_CHAIN_ID &&
    process.env.BLOCKCHAIN_CHAIN_ID !== "11155111"
  )
    throw new SafeError("Configured chain ID must be 11155111");
  const v3 = new URL(".secrets/sepolia-operator.v3.json", root);
  const accountFile = existsSync(v3)
    ? v3
    : new URL(".secrets/sepolia-operator.dpapi.json", root);
  const address =
    process.env.BLOCKCHAIN_OPERATOR_ADDRESS ||
    (existsSync(accountFile)
      ? "0x" +
        JSON.parse(readFileSync(accountFile, "utf8")).address.replace(
          /^0x/i,
          "",
        )
      : undefined);
  if (!/^0x[0-9a-fA-F]{40}$/.test(address ?? ""))
    throw new SafeError("A valid operator address is required");
  let id = 0;
  async function rpc(method, params = []) {
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
        signal: AbortSignal.timeout(20000),
        redirect: "error",
      });
    } catch {
      throw new SafeError(`${method}: connection failed or timed out`);
    }
    if (!response.ok) throw new SafeError(`${method}: HTTP ${response.status}`);
    let body;
    try {
      body = await response.json();
    } catch {
      throw new SafeError(`${method}: invalid JSON response`);
    }
    if (
      body.error ||
      body.id !== id ||
      body.jsonrpc !== "2.0" ||
      body.result === undefined
    )
      throw new SafeError(`${method}: invalid RPC result`);
    return body.result;
  }
  const chainId = await rpc("eth_chainId");
  if (BigInt(chainId) !== 11155111n)
    throw new SafeError("Wrong network: expected Sepolia chain ID 11155111");
  const blockNumber = await rpc("eth_blockNumber");
  const block = await rpc("eth_getBlockByNumber", [blockNumber, false]);
  if (
    !block ||
    block.number !== blockNumber ||
    !/^0x[0-9a-fA-F]{64}$/.test(block.hash)
  )
    throw new SafeError("Block validation failed");
  const wei = BigInt(await rpc("eth_getBalance", [address, blockNumber]));
  console.log(
    JSON.stringify(
      {
        status: "rpc-verified",
        provider: url.hostname.endsWith("alchemy.com") ? "Alchemy" : "Infura",
        chainId: BigInt(chainId).toString(),
        blockNumber: BigInt(blockNumber).toString(),
        blockHash: block.hash,
        address,
        balanceWei: wei.toString(),
        balanceETH: `${wei / 10n ** 18n}.${(wei % 10n ** 18n).toString().padStart(18, "0")}`,
        funded: wei > 0n,
        checkedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  if (wei === 0n) process.exitCode = 2;
}

main().catch((error) => {
  console.error(
    error instanceof SafeError
      ? error.message
      : "RPC validation failed; check local configuration and provider response.",
  );
  process.exitCode = 1;
});
