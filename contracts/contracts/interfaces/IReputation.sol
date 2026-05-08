// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IReputation {
    function updateRep(address user, int256 delta) external;
    function getScore(address user) external view returns (int256);
}
