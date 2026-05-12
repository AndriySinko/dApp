// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IReputation {
    function updateRep(address user, int256 delta, address challenge) external;
    function batchUpdateRep(address[] calldata users, int256[] calldata deltas, address challenge) external;
    function getScore(address user) external view returns (int256);
    function authorize(address caller) external;
    function authorizeChallenge(address challenge) external;
}
