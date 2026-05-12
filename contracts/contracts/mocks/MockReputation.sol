// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IReputation.sol";

contract MockReputation is IReputation {
    mapping(address => int256) public scores;

    function updateRep(address user, int256 delta, address) external override {
        scores[user] += delta;
    }

    function getScore(address user) external view override returns (int256) {
        return scores[user];
    }

    function batchUpdateRep(address[] calldata users, int256[] calldata deltas, address) external override {
        for (uint256 i = 0; i < users.length; i++) {
            scores[users[i]] += deltas[i];
        }
    }

    function authorize(address) external override {}
    function authorizeChallenge(address) external override {}
}
