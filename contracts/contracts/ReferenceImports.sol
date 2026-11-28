// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {TREXFactory} from "@erc3643org/erc-3643/contracts/factory/TREXFactory.sol";
import {Token} from "@erc3643org/erc-3643/contracts/token/Token.sol";
import {IdentityRegistry} from "@erc3643org/erc-3643/contracts/registry/implementation/IdentityRegistry.sol";
import {ClaimTopicsRegistry} from "@erc3643org/erc-3643/contracts/registry/implementation/ClaimTopicsRegistry.sol";
import {TrustedIssuersRegistry} from "@erc3643org/erc-3643/contracts/registry/implementation/TrustedIssuersRegistry.sol";
import {IdentityRegistryStorage} from "@erc3643org/erc-3643/contracts/registry/implementation/IdentityRegistryStorage.sol";
import {ModularCompliance} from "@erc3643org/erc-3643/contracts/compliance/modular/ModularCompliance.sol";
import {TREXImplementationAuthority} from "@erc3643org/erc-3643/contracts/proxy/authority/TREXImplementationAuthority.sol";
import {Identity} from "@onchain-id/solidity/contracts/Identity.sol";
import {ClaimIssuer} from "@onchain-id/solidity/contracts/ClaimIssuer.sol";
import {IdFactory} from "@onchain-id/solidity/contracts/factory/IdFactory.sol";
