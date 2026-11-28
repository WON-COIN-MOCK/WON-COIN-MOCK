import { existsSync } from "node:fs";
import { configVariable, defineConfig } from "hardhat/config";

const env = new URL("../.env", import.meta.url);
if (existsSync(env)) process.loadEnvFile(env);

// Hardhat CLI가 설정 파일의 기본 내보내기를 직접 읽는다.
//noinspection JSUnusedGlobalSymbols
export default defineConfig({
  solidity: {
    version: "0.8.17",
    settings: {
      evmVersion: "london",
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    //noinspection SpellCheckingInspection
    sepolia: {
      type: "http",
      chainType: "l1",
      chainId: 11155111,
      url: configVariable("BLOCKCHAIN_RPC_URL"),
      accounts: [],
    },
  },
});
