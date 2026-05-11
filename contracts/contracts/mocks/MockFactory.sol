// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../Types.sol";

// Stub for ChallengeFactory used in PublicGovernance tests.
// Accepts ETH from tickEpoch and returns a predictable dummy address.
contract MockFactory {
    uint256 public callCount;
    address public constant DUMMY_CHALLENGE = address(1);

    function createChallenge(
        ChallengeType,
        VerifierType,
        string calldata,
        string calldata,
        uint256,
        uint256,
        uint256
    ) external payable returns (address) {
        callCount++;
        return DUMMY_CHALLENGE;
    }

    // Allow querying received ETH in tests
    function balance() external view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {}
}
