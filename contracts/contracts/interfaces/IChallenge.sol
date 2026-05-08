// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IChallenge {
    function receiveVerdict(uint256 challengeId, address participant, bool completed) external;
}
