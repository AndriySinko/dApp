// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../challenges/GroupChallenge.sol";

contract GroupChallengeDeployer {
    address public factory;
    address private _owner;

    constructor() { _owner = msg.sender; }

    // Called once by the deployer EOA after the factory contract is live.
    function initFactory(address _factory) external {
        require(msg.sender == _owner,   "Only owner");
        require(factory == address(0),  "Already set");
        require(_factory != address(0), "Zero address");
        factory = _factory;
    }

    function deploy(
        uint256 id,
        address creatorAddr,
        string calldata titleStr,
        string calldata criteriaStr,
        uint256 joinDl,
        uint256 challengeDl,
        uint256 buyInAmt,
        VerifierType vType,
        address vAddress,
        address repAddress,
        address treasAddress
    ) external returns (address) {
        require(msg.sender == factory, "Only factory");
        return address(new GroupChallenge(
            id, creatorAddr, titleStr, criteriaStr,
            joinDl, challengeDl, buyInAmt,
            vType, vAddress, repAddress, treasAddress, factory
        ));
    }
}
