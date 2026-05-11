// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IChallenge {
    function receiveVerdict(address participant, bool passed) external;
    function setUpkeepRegistered() external;
}
