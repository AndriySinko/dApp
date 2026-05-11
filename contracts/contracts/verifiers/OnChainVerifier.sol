// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IVerifier.sol";
import "../interfaces/IChallenge.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

interface IEvidenceSource {
    function getDaysComplete(address participant) external view returns (uint256);
}

// OnChainVerifier — generic on-chain state verifier.
//
// Criteria string formats (all backward-compatible):
//
//  LEGACY (shorthand):
//    evidence:<days>               getDaysComplete(participant) >= days
//    erc20:<addr>:<minWei>         ERC20.balanceOf(participant) >= minWei
//    nft:<addr>                    ERC721.balanceOf(participant) >= 1
//    nft:<addr>:<min>              ERC721.balanceOf(participant) >= min
//    erc1155:<addr>:<tokenId>:<min> ERC1155.balanceOf(participant, tokenId) >= min
//    eth:<minWei>                  participant.balance >= minWei
//
//  GENERIC (deploy once, works for any contract forever):
//    call:<addr>:<fn(address)>:<op>:<threshold>
//    call:<addr>:<fn(address,uint256)>:<arg2>:<op>:<threshold>
//
//    <fn>       — Solidity function signature e.g. "balanceOf(address)"
//    <op>       — gte | lte | gt | lt | eq | neq
//    <threshold>— decimal number
//
//  COMPOUND (AND / OR):
//    and:<criteria1>|<criteria2>|<criteria3>   all must pass
//    or:<criteria1>|<criteria2>                any must pass
//
//  Examples:
//    call:0xLink...:balanceOf(address):gte:1000000000000000000
//    call:0xRep...:getScore(address):gte:100
//    call:0xStaking...:stakedBalance(address):gte:500000000000000000
//    call:0xNFT...:balanceOf(address):gte:3
//    call:0xERC1155...:balanceOf(address,uint256):42:gte:5
//    eth::gte:500000000000000000
//    and:eth::gte:100000000000000000|call:0xLink...:balanceOf(address):gte:1000000000000000000

contract OnChainVerifier is IVerifier {

    event VerificationRequested(address indexed challengeAddress, address indexed participant);
    event VerdictDelivered(address indexed challengeAddress, address indexed participant, bool passed);
    event VerificationFailed(address indexed challengeAddress, address indexed participant, bool verdict);

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

    function evaluate(
        string memory criteria,
        address challengeAddress,
        address participant
    ) external view returns (bool) {
        return _evaluate(bytes(criteria), challengeAddress, participant);
    }

    // ── Main evaluator ────────────────────────────────────────────────────────

    function _evaluate(
        bytes memory b,
        address challengeAddress,
        address participant
    ) private view returns (bool) {

        // ── Compound: and:<c1>|<c2>|... ──────────────────────────────────────
        if (_startsWith(b, bytes("and:"))) {
            bytes[] memory parts = _splitBy(b, 4, "|");
            for (uint256 i = 0; i < parts.length; i++) {
                if (!_evaluate(parts[i], challengeAddress, participant)) return false;
            }
            return true;
        }

        // ── Compound: or:<c1>|<c2>|... ───────────────────────────────────────
        if (_startsWith(b, bytes("or:"))) {
            bytes[] memory parts = _splitBy(b, 3, "|");
            for (uint256 i = 0; i < parts.length; i++) {
                if (_evaluate(parts[i], challengeAddress, participant)) return true;
            }
            return false;
        }

        // ── Evidence (days complete) ──────────────────────────────────────────
        if (_startsWith(b, bytes("evidence:"))) {
            uint256 required = _parseUint(b, 9);
            return IEvidenceSource(challengeAddress).getDaysComplete(participant) >= required;
        }

        // ── Native ETH balance: eth::<op>:<threshold> ────────────────────────
        if (_startsWith(b, bytes("eth:"))) {
            uint256 c1  = _findColon(b, 4);           // skip optional addr field
            uint256 c2  = _findColon(b, c1 + 1);
            string memory op  = string(_slice(b, c1 + 1, c2 - c1 - 1));
            uint256 threshold = _parseUint(b, c2 + 1);
            return _compare(participant.balance, op, threshold);
        }

        // ── ERC-20: erc20:<addr>:<minWei> ────────────────────────────────────
        if (_startsWith(b, bytes("erc20:"))) {
            address token  = _parseAddress(b, 6);
            uint256 colon2 = _findColon(b, 48);
            uint256 minAmt = _parseUint(b, colon2 + 1);
            return IERC20(token).balanceOf(participant) >= minAmt;
        }

        // ── ERC-721: nft:<addr> or nft:<addr>:<min> ──────────────────────────
        if (_startsWith(b, bytes("nft:"))) {
            address nft   = _parseAddress(b, 4);
            uint256 min   = 1;
            if (b.length > 46 && b[46] == ":") min = _parseUint(b, 47);
            return IERC721(nft).balanceOf(participant) >= min;
        }

        // ── ERC-1155: erc1155:<addr>:<tokenId>:<min> ─────────────────────────
        if (_startsWith(b, bytes("erc1155:"))) {
            address token   = _parseAddress(b, 8);
            uint256 colon2  = _findColon(b, 50);
            uint256 tokenId = _parseUint(b, colon2 + 1);
            uint256 colon3  = _findColon(b, colon2 + 1);
            uint256 min     = _parseUint(b, colon3 + 1);
            return IERC1155(token).balanceOf(participant, tokenId) >= min;
        }

        // ── Generic call: call:<addr>:<fn(...)>:<[arg2:]><op>:<threshold> ─────
        if (_startsWith(b, bytes("call:"))) {
            return _evaluateGenericCall(b, participant);
        }

        revert("OnChainVerifier: unknown criteria type");
    }

    // ── Generic call evaluator ────────────────────────────────────────────────
    //
    // Parses: call:<addr>:<fn(address)>:<op>:<threshold>
    //     or: call:<addr>:<fn(address,uint256)>:<arg2>:<op>:<threshold>
    //
    // Calls the function with participant (and optional arg2) via staticcall.
    // Decodes the first uint256 from the return data and applies the operator.

    function _evaluateGenericCall(
        bytes memory b,
        address participant
    ) private view returns (bool) {
        // offset 5 = after "call:"
        address target = _parseAddress(b, 5);          // 42 chars
        uint256 colon1 = _findColon(b, 47);             // after addr

        // find next colon after function signature (closing paren + colon)
        uint256 parenClose = _findByte(b, colon1 + 1, ")");
        uint256 colon2     = _findColon(b, parenClose + 1);

        // function signature slice
        bytes memory fnSig = _slice(b, colon1 + 1, parenClose - colon1);

        // check if first arg is address or (address,uint256)
        bool hasTwoArgs = _containsComma(fnSig);

        // if two args, next field is the second arg value, then op and threshold
        uint256 arg2;
        uint256 opOffset;
        if (hasTwoArgs) {
            uint256 colon3 = _findColon(b, colon2 + 1);
            arg2      = _parseUint(b, colon2 + 1);
            opOffset  = colon3;
        } else {
            opOffset  = colon2;
        }

        uint256 colonOp   = _findColon(b, opOffset + 1);
        string memory op  = string(_slice(b, opOffset + 1, colonOp - opOffset - 1));
        uint256 threshold = _parseUint(b, colonOp + 1);

        // Build calldata
        bytes4 selector   = bytes4(keccak256(fnSig));
        bytes memory data;
        if (hasTwoArgs) {
            data = abi.encodeWithSelector(selector, participant, arg2);
        } else {
            data = abi.encodeWithSelector(selector, participant);
        }

        // staticcall — safe, no state changes possible
        (bool success, bytes memory returnData) = target.staticcall(data);
        require(success && returnData.length >= 32, "OnChainVerifier: call failed");

        uint256 result = abi.decode(returnData, (uint256));
        return _compare(result, op, threshold);
    }

    // ── Comparison ────────────────────────────────────────────────────────────

    function _compare(uint256 value, string memory op, uint256 threshold) private pure returns (bool) {
        bytes32 h = keccak256(bytes(op));
        if (h == keccak256("gte")) return value >= threshold;
        if (h == keccak256("lte")) return value <= threshold;
        if (h == keccak256("gt"))  return value >  threshold;
        if (h == keccak256("lt"))  return value <  threshold;
        if (h == keccak256("eq"))  return value == threshold;
        if (h == keccak256("neq")) return value != threshold;
        revert("OnChainVerifier: unknown operator");
    }

    // ── Bytes utilities ───────────────────────────────────────────────────────

    function _startsWith(bytes memory b, bytes memory prefix) private pure returns (bool) {
        if (b.length < prefix.length) return false;
        for (uint256 i = 0; i < prefix.length; i++) {
            if (b[i] != prefix[i]) return false;
        }
        return true;
    }

    function _parseUint(bytes memory b, uint256 offset) private pure returns (uint256 result) {
        require(offset < b.length, "OnChainVerifier: empty uint");
        for (uint256 i = offset; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            if (c < 48 || c > 57) break;
            result = result * 10 + (c - 48);
        }
    }

    function _parseAddress(bytes memory b, uint256 offset) private pure returns (address) {
        require(b.length >= offset + 42, "OnChainVerifier: address too short");
        require(b[offset] == "0" && b[offset + 1] == "x", "OnChainVerifier: missing 0x");
        uint160 result;
        for (uint256 i = 0; i < 40; i++) {
            result = result * 16 + _hexNibble(b[offset + 2 + i]);
        }
        return address(result);
    }

    function _findColon(bytes memory b, uint256 offset) private pure returns (uint256) {
        for (uint256 i = offset; i < b.length; i++) {
            if (b[i] == ":") return i;
        }
        revert("OnChainVerifier: colon not found");
    }

    function _findByte(bytes memory b, uint256 offset, bytes1 target) private pure returns (uint256) {
        for (uint256 i = offset; i < b.length; i++) {
            if (b[i] == target) return i;
        }
        revert("OnChainVerifier: byte not found");
    }

    function _slice(bytes memory b, uint256 offset, uint256 length) private pure returns (bytes memory result) {
        result = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = b[offset + i];
        }
    }

    function _containsComma(bytes memory b) private pure returns (bool) {
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == ",") return true;
        }
        return false;
    }

    // Split b starting at offset by delimiter, return array of sub-byte arrays
    function _splitBy(bytes memory b, uint256 offset, string memory delim) private pure returns (bytes[] memory) {
        bytes1 d = bytes(delim)[0];
        // count parts
        uint256 count = 1;
        for (uint256 i = offset; i < b.length; i++) {
            if (b[i] == d) count++;
        }
        bytes[] memory parts = new bytes[](count);
        uint256 idx = 0;
        uint256 start = offset;
        for (uint256 i = offset; i <= b.length; i++) {
            if (i == b.length || b[i] == d) {
                parts[idx] = _slice(b, start, i - start);
                idx++;
                start = i + 1;
            }
        }
        return parts;
    }

    function _hexNibble(bytes1 c) private pure returns (uint8) {
        uint8 v = uint8(c);
        if (v >= 48 && v <= 57)  return v - 48;
        if (v >= 97 && v <= 102) return v - 87;
        if (v >= 65 && v <= 70)  return v - 55;
        revert("OnChainVerifier: invalid hex char");
    }
}
