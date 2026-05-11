// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IVerifier.sol";
import "../interfaces/IChallenge.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

// Minimal view surface needed from the challenge for evidence-based checks.
interface IEvidenceSource {
    function getDaysComplete(address participant) external view returns (uint256);
}

// OnChainVerifier reads publicly available on-chain state to decide pass/fail.
// Verification is synchronous: receiveVerdict is called in the same transaction
// as requestVerification, so no pending state or owner involvement is needed.
//
// Criteria string format (set by the challenge creator, colon-delimited):
//
//   "evidence:<days>"              getDaysComplete(participant) >= days
//   "erc20:<addr>:<minWei>"        IERC20(addr).balanceOf(participant) >= minWei
//   "nft:<addr>"                   IERC721(addr).balanceOf(participant) >= 1
//
// The criteria string is decoded from params = abi.encode(criteria, serviceAccountId),
// which is the standard encoding used by all challenge contracts.
// serviceAccountId is not used for on-chain checks.
contract OnChainVerifier is IVerifier {

    event VerificationRequested(address indexed challengeAddress, address indexed participant);
    event VerdictDelivered(address indexed challengeAddress, address indexed participant, bool passed);
    event VerificationFailed(address indexed challengeAddress, address indexed participant, bool verdict);

    // Called by the challenge during _onVerifyPending.
    // Evaluates the criteria against current on-chain state and delivers the verdict
    // back to the challenge in the same transaction.
    function requestVerification(
        address challengeAddress,
        address participant,
        bytes calldata params
    ) external override {
        require(msg.sender == challengeAddress, "Caller must be the challenge contract");

        (string memory criteria,) = abi.decode(params, (string, string));

        emit VerificationRequested(challengeAddress, participant);

        bool passed;
        try this.evaluate(criteria, challengeAddress, participant) returns (bool result) {
            passed = result;
        } catch {
            emit VerificationFailed(challengeAddress, participant, false);
            try IChallenge(challengeAddress).receiveVerdict(participant, false) {} catch {}
            return;
        }

        try IChallenge(challengeAddress).receiveVerdict(participant, passed) {
            emit VerdictDelivered(challengeAddress, participant, passed);
        } catch {
            emit VerificationFailed(challengeAddress, participant, passed);
        }
    }

    // ── Evaluation ────────────────────────────────────────────────────────────

    // External so it can be called via `this.evaluate()` inside a try/catch,
    // allowing external call reverts (e.g. malicious token) to be caught.
    function evaluate(
        string memory criteria,
        address challengeAddress,
        address participant
    ) external view returns (bool) {
        return _evaluate(criteria, challengeAddress, participant);
    }

    function _evaluate(
        string memory criteria,
        address challengeAddress,
        address participant
    ) private view returns (bool) {
        bytes memory b = bytes(criteria);

        if (_startsWith(b, bytes("evidence:"))) {
            uint256 required = _parseUint(b, 9); // len("evidence:") == 9
            return IEvidenceSource(challengeAddress).getDaysComplete(participant) >= required;
        }

        if (_startsWith(b, bytes("erc20:"))) {
            // "erc20:0x<40 hex chars>:<decimal amount>"
            // addr starts at offset 6 (len("erc20:") == 6), occupies 42 chars → colon at 48
            address token  = _parseAddress(b, 6);
            uint256 colon2 = _findColon(b, 48);
            uint256 minAmt = _parseUint(b, colon2 + 1);
            return IERC20(token).balanceOf(participant) >= minAmt;
        }

        if (_startsWith(b, bytes("nft:"))) {
            // "nft:0x<40 hex chars>"
            address nft = _parseAddress(b, 4); // len("nft:") == 4
            return IERC721(nft).balanceOf(participant) >= 1;
        }

        revert("OnChainVerifier: unknown criteria type");
    }

    // ── Bytes utilities ───────────────────────────────────────────────────────

    function _startsWith(bytes memory b, bytes memory prefix) private pure returns (bool) {
        if (b.length < prefix.length) return false;
        for (uint256 i = 0; i < prefix.length; i++) {
            if (b[i] != prefix[i]) return false;
        }
        return true;
    }

    // Parse a decimal uint from b[offset], stopping at the first non-digit character.
    function _parseUint(bytes memory b, uint256 offset) private pure returns (uint256 result) {
        require(offset < b.length, "OnChainVerifier: empty uint");
        for (uint256 i = offset; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            if (c < 48 || c > 57) break;
            result = result * 10 + (c - 48);
        }

        return result;
    }

    // Parse a checksummed or lowercase "0x<40 hex chars>" address starting at b[offset].
    function _parseAddress(bytes memory b, uint256 offset) private pure returns (address) {
        require(b.length >= offset + 42, "OnChainVerifier: address too short");
        require(b[offset] == "0" && b[offset + 1] == "x", "OnChainVerifier: missing 0x");
        uint160 result;
        for (uint256 i = 0; i < 40; i++) {
            result = result * 16 + _hexNibble(b[offset + 2 + i]);
        }
        return address(result);
    }

    // Return the index of the next ':' at or after b[offset]. Reverts if not found.
    function _findColon(bytes memory b, uint256 offset) private pure returns (uint256) {
        for (uint256 i = offset; i < b.length; i++) {
            if (b[i] == ":") return i;
        }
        revert("OnChainVerifier: colon not found");
    }

    function _hexNibble(bytes1 c) private pure returns (uint8) {
        uint8 v = uint8(c);
        if (v >= 48 && v <= 57)  return v - 48;  // '0'–'9'
        if (v >= 97 && v <= 102) return v - 87;  // 'a'–'f'
        if (v >= 65 && v <= 70)  return v - 55;  // 'A'–'F'
        revert("OnChainVerifier: invalid hex char");
    }
}
