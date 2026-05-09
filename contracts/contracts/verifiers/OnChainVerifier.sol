// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IVerifier.sol";
import "../interfaces/IChallenge.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract OnChainVerifier is IVerifier, Ownable {
    // Tracks which (challenge, participant) pairs have an outstanding verification request.
    // Prevents the owner from submitting unsolicited verdicts and guards against double-submission.
    mapping(address => mapping(address => bool)) private _pendingVerifications;

    event VerificationRequested(address indexed challenge, address indexed participant, bytes params);
    event VerdictSubmitted(address indexed challenge, address indexed participant, bool passed);
    event VerificationCancelled(address challengeAddress, address participant);

    constructor(address initialOwner) Ownable(initialOwner) {}

    // Only the challenge contract itself may request verification for its own participants.
    function requestVerification(
        address challengeAddress,
        address participant,
        bytes calldata params
    ) external override {
        require(msg.sender == challengeAddress, "Caller must be the challenge contract");
        require(!_pendingVerifications[challengeAddress][participant], "Verification already pending");
        _pendingVerifications[challengeAddress][participant] = true;
        emit VerificationRequested(challengeAddress, participant, params);
    }

    // Owner reviews the VerificationRequested event (which carries the full params) and calls this.
    function submitVerdict(address challengeAddress, address participant, bool passed) external onlyOwner {
        require(_pendingVerifications[challengeAddress][participant], "No pending verification");
        delete _pendingVerifications[challengeAddress][participant];
        emit VerdictSubmitted(challengeAddress, participant, passed);
        IChallenge(challengeAddress).receiveVerdict(participant, passed);
    }

    function cancelVerification(address challengeAddress, address participant) external onlyOwner {
        require(_pendingVerifications[challengeAddress][participant], "No pending verification");
        delete _pendingVerifications[challengeAddress][participant];
        emit VerificationCancelled(challengeAddress, participant);
    }
}
