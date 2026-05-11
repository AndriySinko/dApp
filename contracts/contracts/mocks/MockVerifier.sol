// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IVerifier.sol";
import "../interfaces/IChallenge.sol";

// Test helper: synchronous mock verifier.
// When autoDeliver=true (default), immediately calls receiveVerdict in the same tx.
// When false, stores requests so tests can deliver verdicts individually.
contract MockVerifier is IVerifier {
    bool public autoDeliver = true;
    bool public defaultResult = true;

    mapping(address => bool) public participantResult;
    mapping(address => bool) public hasOverride;

    struct PendingRequest { address challengeAddress; address participant; }
    PendingRequest[] private _pending;

    function setAutoDeliver(bool auto_, bool result_) external {
        autoDeliver = auto_;
        defaultResult = result_;
    }

    function setParticipantResult(address participant, bool result) external {
        participantResult[participant] = result;
        hasOverride[participant] = true;
    }

    function requestVerification(
        address challengeAddress,
        address participant,
        bytes calldata
    ) external override {
        if (autoDeliver) {
            bool result = hasOverride[participant] ? participantResult[participant] : defaultResult;
            IChallenge(challengeAddress).receiveVerdict(participant, result);
        } else {
            _pending.push(PendingRequest(challengeAddress, participant));
        }
    }

    function deliverVerdict(uint256 index, bool passed) external {
        PendingRequest memory r = _pending[index];
        IChallenge(r.challengeAddress).receiveVerdict(r.participant, passed);
    }

    function pendingCount() external view returns (uint256) {
        return _pending.length;
    }

    function getPending(uint256 index) external view returns (address challengeAddress, address participant) {
        PendingRequest memory r = _pending[index];
        return (r.challengeAddress, r.participant);
    }
}
