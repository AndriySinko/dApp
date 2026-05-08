// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IVerifier.sol";

contract OnChainVerifier is IVerifier {
    function requestVerification(uint256 challengeId, address participant, bytes calldata params) external override {
    }
}
