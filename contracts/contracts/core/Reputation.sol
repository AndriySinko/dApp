// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IReputation.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Reputation is Ownable, IReputation {
    mapping(address => int256) scores;
    mapping(address => bool)   authorized;

    modifier onlyAuthorized() {
        require(authorized[msg.sender], "Not authorized");
        _;
    }

    event ReputationUpdated(
        address indexed user,
        int256  delta,
        int256  newScore,
        address indexed challenge,
        uint256 timestamp
    );

    constructor(address initialOwner) Ownable(initialOwner) {}

    function authorize(address caller) external onlyOwner {
        require(caller != address(0), "Zero address");
        authorized[caller] = true;
    }

    function deauthorize(address caller) external onlyOwner {
        authorized[caller] = false;
    }

    function updateRep(address user, int256 delta, address challenge) external onlyAuthorized{
        scores[user] += delta;
        emit ReputationUpdated(user, delta, scores[user], challenge, block.timestamp);
    }
    function getScore(address user) external view returns (int256){
        return scores[user];
    }
}
