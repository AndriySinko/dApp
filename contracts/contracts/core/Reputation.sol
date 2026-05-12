// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IReputation.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Reputation is Ownable, IReputation {
    mapping(address => int256) scores;
    mapping(address => bool)   authorized;
    address public factory;

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

    function setFactory(address _factory) external onlyOwner {
        require(factory == address(0), "Already set");
        require(_factory != address(0), "Zero address");
        factory = _factory;
    }

    // Called by factory to authorize each newly deployed challenge contract
    function authorizeChallenge(address challenge) external {
        require(msg.sender == factory, "Only factory");
        require(challenge != address(0), "Zero address");
        authorized[challenge] = true;
    }

    function authorize(address caller) external onlyOwner {
        require(caller != address(0), "Zero address");
        authorized[caller] = true;
    }

    function revoke(address caller) external onlyOwner {
        authorized[caller] = false;
    }

    function updateRep(address user, int256 delta, address challenge) external onlyAuthorized {
        scores[user] += delta;
        emit ReputationUpdated(user, delta, scores[user], challenge, block.timestamp);
    }

    function batchUpdateRep(address[] calldata users, int256[] calldata deltas, address challenge) external onlyAuthorized {
        require(users.length == deltas.length, "Length mismatch");
        for (uint256 i = 0; i < users.length; i++) {
            scores[users[i]] += deltas[i];
            emit ReputationUpdated(users[i], deltas[i], scores[users[i]], challenge, block.timestamp);
        }
    }

    function getScore(address user) external view returns (int256) {
        return scores[user];
    }
}
