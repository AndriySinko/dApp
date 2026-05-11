// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IVerifier.sol";

// Comprehensive mock challenge for verifier tests.
// Implements every interface a verifier may call back into:
//   IEvidenceSource (OnChainVerifier evidence check)
//   IAiChallenge    (AiOracleVerifier evidence + deadline reads)
//   IChallenge      (receiveVerdict callback)
// Also acts as a proxy so tests can trigger requestVerification
// from this contract's address (satisfying the msg.sender == challengeAddress guard).
contract MockChallenge {
    // ── Evidence-based checks (OnChainVerifier / AiOracleVerifier) ────────────
    struct Evidence {
        uint256 day;
        string  ipfsCid;
        bytes32 nonce;
        uint256 timestamp;
        bool    verified;
    }

    mapping(address => uint256)    public daysComplete;
    mapping(address => Evidence[]) private _evidence;
    uint256 public joinDeadline_;
    uint256 public challengeDeadline_;

    // ── Verdict recording ─────────────────────────────────────────────────────
    mapping(address => bool) public lastVerdict;
    mapping(address => bool) public verdictReceived;
    bool public revertOnVerdict;

    constructor(uint256 _joinDl, uint256 _challengeDl) {
        joinDeadline_      = _joinDl;
        challengeDeadline_ = _challengeDl;
    }

    // ── Test helpers ──────────────────────────────────────────────────────────

    function setDaysComplete(address participant, uint256 count) external {
        daysComplete[participant] = count;
    }

    function setRevertOnVerdict(bool shouldRevert) external {
        revertOnVerdict = shouldRevert;
    }

    function addEvidence(
        address participant,
        uint256 day,
        string calldata ipfsCid,
        bytes32 nonce
    ) external {
        _evidence[participant].push(
            Evidence({ day: day, ipfsCid: ipfsCid, nonce: nonce, timestamp: block.timestamp, verified: false })
        );
    }

    // Proxy: calls verifier.requestVerification(address(this), ...) so that
    // msg.sender == challengeAddress inside the verifier.
    function callRequestVerification(
        address verifier,
        address participant,
        bytes calldata params
    ) external {
        IVerifier(verifier).requestVerification(address(this), participant, params);
    }

    // ── IEvidenceSource / IAiChallenge interface ──────────────────────────────

    function getDaysComplete(address participant) external view returns (uint256) {
        return daysComplete[participant];
    }

    function getEvidence(address participant) external view returns (Evidence[] memory) {
        return _evidence[participant];
    }

    function joinDeadline() external view returns (uint256) { return joinDeadline_; }
    function challengeDeadline() external view returns (uint256) { return challengeDeadline_; }

    // ── IChallenge interface ──────────────────────────────────────────────────

    function receiveVerdict(address participant, bool passed) external {
        if (revertOnVerdict) revert("MockChallenge: revert on verdict");
        lastVerdict[participant]    = passed;
        verdictReceived[participant] = true;
    }
}
