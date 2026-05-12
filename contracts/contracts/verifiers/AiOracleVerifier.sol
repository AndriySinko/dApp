// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IVerifier.sol";
import "../interfaces/IChallenge.sol";
import {FunctionsClient}  from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Minimal view surface needed from the challenge contract.
interface IAiChallenge {
    struct Evidence {
        uint256 day;
        string  ipfsCid;
        bytes32 nonce;
        uint256 timestamp;
        bool    verified;
    }
    function getEvidence(address participant) external view returns (Evidence[] memory);
    function joinDeadline() external view returns (uint256);
    function challengeDeadline() external view returns (uint256);
}

contract AiOracleVerifier is IVerifier, FunctionsClient, Ownable {
    using FunctionsRequest for FunctionsRequest.Request;

    uint32 public callbackGasLimit = 200_000;

    function setCallbackGasLimit(uint32 limit) external onlyOwner {
        callbackGasLimit = limit;
    }

    struct PendingRequest {
        address challengeAddress;
        address participant;
    }

    mapping(bytes32 => PendingRequest)              private _pendingRequests;
    mapping(address => mapping(address => bool))    private _pendingVerifications;
    mapping(address => mapping(address => bytes32)) private _activeRequestId;
    mapping(address => mapping(address => bytes))   private _storedParams;

    // JS source executed by the Chainlink DON.
    // Receives:
    //   args[0] = criteria string
    //   args[1] = comma-separated IPFS CIDs (one per evidence entry)
    //   args[2] = comma-separated expected nonces in hex (one per evidence entry)
    //   args[3] = required unique-day count (decimal)
    //
    // For each (CID, nonce) pair the JS fetches the IPFS image and asks Gemini Vision
    // whether the evidence shows the criteria was met AND the expected nonce is visibly
    // present (anti-replay). It groups by nonce value to deduplicate same-day entries,
    // then returns Functions.encodeUint256(1) if validDays >= requiredDays, else 0.
    string  public jsSource;
    uint64  public subscriptionId;
    bytes32 public donId;

    // DON-hosted secrets slot uploaded via uploadSecrets.ts.
    // Both must be set before any verification request is dispatched.
    uint8  public secretsSlotId;
    uint64 public secretsVersion;

    event JsSourceUpdated(address indexed owner);
    event SubscriptionIdUpdated(uint64 subscriptionId);
    event SecretsReferenceUpdated(uint8 slotId, uint64 version);

    event VerificationRequested(
        address indexed challengeAddress,
        address indexed participant,
        bytes32 indexed requestId
    );
    event VerificationRetried(
        address indexed challengeAddress,
        address indexed participant,
        bytes32 indexed newRequestId
    );
    event VerdictDelivered(
        address indexed challengeAddress,
        address indexed participant,
        bool    passed,
        bytes32 requestId
    );
    event VerificationErrored(
        address indexed challengeAddress,
        address indexed participant,
        bytes32 requestId,
        bytes   err
    );

    constructor(
        address router,
        address initialOwner,
        uint64  _subscriptionId,
        bytes32 _donId
    ) FunctionsClient(router) Ownable(initialOwner) {
        subscriptionId = _subscriptionId;
        donId          = _donId;
    }

    // ── Configuration (owner only) ────────────────────────────────────────────

    function setJsSource(string calldata _jsSource) external onlyOwner {
        require(bytes(_jsSource).length > 0, "Empty source");
        jsSource = _jsSource;
        emit JsSourceUpdated(msg.sender);
    }

    function setSubscriptionId(uint64 _subscriptionId) external onlyOwner {
        subscriptionId = _subscriptionId;
        emit SubscriptionIdUpdated(_subscriptionId);
    }

    function setDonId(bytes32 _donId) external onlyOwner {
        donId = _donId;
    }

    // Call once after uploadSecrets.ts prints the slot version.
    function setSecretsReference(uint8 _slotId, uint64 _version) external onlyOwner {
        secretsSlotId   = _slotId;
        secretsVersion  = _version;
        emit SecretsReferenceUpdated(_slotId, _version);
    }

    // ── IVerifier ─────────────────────────────────────────────────────────────

    // Called by the challenge during _onVerifyPending.
    // params = abi.encode(criteria, serviceAccountId) — serviceAccountId is unused here;
    // evidence is read directly from the challenge contract.
    function requestVerification(
        address challengeAddress,
        address participant,
        bytes calldata params
    ) external override {
        require(msg.sender == challengeAddress,                        "Caller must be the challenge contract");
        require(!_pendingVerifications[challengeAddress][participant],  "Verification already pending");
        require(bytes(jsSource).length > 0,                           "JS source not configured");
        require(secretsVersion > 0,                                   "Secrets not configured");

        _pendingVerifications[challengeAddress][participant] = true;
        _storedParams[challengeAddress][participant]         = params;

        bytes32 requestId = _dispatchRequest(challengeAddress, participant, params);
        emit VerificationRequested(challengeAddress, participant, requestId);
    }

    // ── Owner actions ─────────────────────────────────────────────────────────

    // Re-issues the Chainlink request after a DON error. Blocked while a request is still in flight.
    function retryVerification(address challengeAddress, address participant) external onlyOwner {
        require(_pendingVerifications[challengeAddress][participant],           "No pending verification");
        require(_activeRequestId[challengeAddress][participant] == bytes32(0), "Request still in flight");

        bytes32 requestId = _dispatchRequest(
            challengeAddress,
            participant,
            _storedParams[challengeAddress][participant]
        );
        emit VerificationRetried(challengeAddress, participant, requestId);
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    function _dispatchRequest(
        address challengeAddress,
        address participant,
        bytes memory params
    ) private returns (bytes32 requestId) {
        (string memory criteria,) = abi.decode(params, (string, string));

        IAiChallenge challenge = IAiChallenge(challengeAddress);
        IAiChallenge.Evidence[] memory evidence = challenge.getEvidence(participant);

        uint256 totalDays = (challenge.challengeDeadline() - challenge.joinDeadline()) / 1 days;

        string[] memory args = new string[](4);
        args[0] = criteria;
        args[1] = _buildCidsArg(evidence);
        args[2] = _buildNoncesArg(evidence, challengeAddress);
        args[3] = _uint256ToString(totalDays);

        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(jsSource);
        req.addDONHostedSecrets(secretsSlotId, secretsVersion);
        req.setArgs(args);

        requestId = _sendRequest(req.encodeCBOR(), subscriptionId, callbackGasLimit, donId);

        _pendingRequests[requestId]                     = PendingRequest(challengeAddress, participant);
        _activeRequestId[challengeAddress][participant] = requestId;
    }

    function _buildCidsArg(IAiChallenge.Evidence[] memory evidence) private pure returns (string memory) {
        if (evidence.length == 0) return "";
        bytes memory acc = bytes(evidence[0].ipfsCid);
        for (uint256 i = 1; i < evidence.length; i++) {
            acc = abi.encodePacked(acc, ",", evidence[i].ipfsCid);
        }
        return string(acc);
    }

    // Expected nonce for day d = keccak256(abi.encodePacked(challengeAddress, d)).
    // This mirrors BaseChallenge.getCurrentDayNonce() and is what the participant
    // was required to display visibly in their photo to prevent replay attacks.
    function _buildNoncesArg(
        IAiChallenge.Evidence[] memory evidence,
        address challengeAddress
    ) private pure returns (string memory) {
        if (evidence.length == 0) return "";
        bytes memory acc = bytes(_bytes32ToHex(
            keccak256(abi.encodePacked(challengeAddress, evidence[0].day))
        ));
        for (uint256 i = 1; i < evidence.length; i++) {
            bytes32 nonce = keccak256(abi.encodePacked(challengeAddress, evidence[i].day));
            acc = abi.encodePacked(acc, ",", _bytes32ToHex(nonce));
        }
        return string(acc);
    }

    function _bytes32ToHex(bytes32 value) private pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory result   = new bytes(66); // "0x" + 64 hex chars
        result[0] = "0";
        result[1] = "x";
        for (uint256 i = 0; i < 32; i++) {
            result[2 + i * 2]     = hexChars[uint8(value[i]) >> 4];
            result[2 + i * 2 + 1] = hexChars[uint8(value[i]) & 0x0f];
        }
        return string(result);
    }

    function _uint256ToString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp   = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    // ── Chainlink callback ────────────────────────────────────────────────────

    // Must not revert — any revert bubbles through handleOracleFulfillment and
    // permanently breaks the Chainlink callback for this requestId.
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        PendingRequest memory pending = _pendingRequests[requestId];
        if (pending.challengeAddress == address(0)) return; // unknown id, ignore safely

        delete _pendingRequests[requestId];
        delete _activeRequestId[pending.challengeAddress][pending.participant];

        if (err.length > 0) {
            // Leave _pendingVerifications and _storedParams so the owner can retry.
            emit VerificationErrored(pending.challengeAddress, pending.participant, requestId, err);
            return;
        }

        bool passed = response.length >= 32 && abi.decode(response, (uint256)) == 1;

        // Wrap the external call so a reverting challenge cannot break the Chainlink callback.
        // On success: clear pending state. On failure: preserve it for owner retry.
        try IChallenge(pending.challengeAddress).receiveVerdict(pending.participant, passed) {
            delete _pendingVerifications[pending.challengeAddress][pending.participant];
            delete _storedParams[pending.challengeAddress][pending.participant];
            emit VerdictDelivered(pending.challengeAddress, pending.participant, passed, requestId);
        } catch {
            emit VerificationErrored(pending.challengeAddress, pending.participant, requestId, "");
        }
    }
}
