// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ClaimTopicsRegistry} from "@erc3643org/erc-3643/contracts/registry/implementation/ClaimTopicsRegistry.sol";

contract RegistryCaller {
  /// @notice Attempts an owner-only call from a separate address.
  function tryAdd(ClaimTopicsRegistry registry) external returns (bool) {
    (bool success, ) = address(registry).call(
      abi.encodeWithSelector(registry.addClaimTopic.selector, uint256(1))
    );
    return success;
  }
}

contract ReferenceSmokeTest {
  /// @notice Checks the official registry initialization and owner operation.
  function testOwnerCanAddTopic() public {
    ClaimTopicsRegistry registry = new ClaimTopicsRegistry();
    registry.init();
    registry.addClaimTopic(1);
    uint256[] memory topics = registry.getClaimTopics();
    require(topics.length == 1 && topics[0] == 1, "topic mismatch");
  }

  /// @notice Checks that an unauthorized caller cannot change topics.
  function testUnauthorizedCallerRejected() public {
    ClaimTopicsRegistry registry = new ClaimTopicsRegistry();
    registry.init();
    RegistryCaller caller = new RegistryCaller();
    require(!caller.tryAdd(registry), "unauthorized call accepted");
    require(registry.getClaimTopics().length == 0, "state changed");
  }

  /// @notice Checks that duplicate topics cannot be added.
  function testDuplicateTopicRejected() public {
    ClaimTopicsRegistry registry = new ClaimTopicsRegistry();
    registry.init();
    registry.addClaimTopic(1);
    (bool success, ) = address(registry).call(
      abi.encodeWithSelector(registry.addClaimTopic.selector, uint256(1))
    );
    require(!success, "duplicate accepted");
    require(registry.getClaimTopics().length == 1, "duplicate stored");
  }
}
