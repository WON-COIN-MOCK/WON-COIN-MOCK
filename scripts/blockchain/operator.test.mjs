import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Wallet, Transaction } from "ethers";
import { seal, unlock, sign } from "./operator.mjs";

test("portable V3 round trip, password rejection and Sepolia-only transaction signature", async () => {
  const original = Wallet.createRandom();
  const pass = randomBytes(32).toString("hex");
  const encoded = await seal(original, pass);
  assert.equal(JSON.parse(encoded).version, 3);
  const restored = await unlock(encoded, pass);
  assert.equal(restored.address, original.address);
  await assert.rejects(unlock(encoded, pass + "x"));
  const request = {
    type: 2,
    chainId: 11155111,
    to: original.address,
    nonce: 0,
    value: "0",
    data: "0x",
    gasLimit: "21000",
    maxFeePerGas: "2000000000",
    maxPriorityFeePerGas: "1000000000",
  };
  const tx = Transaction.from(await sign(restored, request));
  assert.equal(tx.from, original.address);
  assert.equal(tx.chainId, 11155111n);
  await assert.rejects(sign(restored, { ...request, chainId: 1 }));
});
