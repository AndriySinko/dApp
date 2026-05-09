// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVerifier {
    function requestVerification(address challengeAddress, address participant, bytes calldata params) external;
}
