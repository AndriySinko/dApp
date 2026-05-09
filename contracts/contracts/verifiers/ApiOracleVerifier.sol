// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IVerifier.sol";
import "../interfaces/IChallenge.sol";
import {FunctionsClient}  from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ApiOracleVerifier is IVerifier, FunctionsClient, Ownable {
    using FunctionsRequest for FunctionsRequest.Request;

    // Gas budget given to fulfillRequest when the DON calls back.
    uint32 public constant CALLBACK_GAS_LIMIT = 200_000;

    struct PendingRequest {
        address challengeAddress;
        address participant;
    }

    // requestId  → metadata needed inside fulfillRequest
    mapping(bytes32 => PendingRequest) private _pendingRequests;

    // challenge → participant → true while a verdict is outstanding (success or error)
    mapping(address => mapping(address => bool))    private _pendingVerifications;

    // challenge → participant → currently in-flight requestId (bytes32(0) = none in flight)
    // Prevents retryVerification from firing while the original request is still live,
    // which would cause a duplicate receiveVerdict call and a reverting Chainlink callback.
    mapping(address => mapping(address => bytes32)) private _activeRequestId;

    // challenge → participant → original params, kept so the owner can retry without re-encoding
    mapping(address => mapping(address => bytes))   private _storedParams;

    // JS source executed by the Chainlink DON.
    // Receives: args[0] = criteria string, args[1] = service account ID (GitHub username, Strava ID, …)
    // Must return: Functions.encodeUint256(1) for pass, Functions.encodeUint256(0) for fail.
    string  public jsSource;
    uint64  public subscriptionId;
    bytes32 public donId;

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
    // Emitted when the DON returns an error; the pending verification is kept alive for retry.
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
    }

    function setSubscriptionId(uint64 _subscriptionId) external onlyOwner {
        subscriptionId = _subscriptionId;
    }

    function setDonId(bytes32 _donId) external onlyOwner {
        donId = _donId;
    }

    // ── IVerifier ─────────────────────────────────────────────────────────────

    // Called by the challenge contract during _onVerifyPending.
    // params = abi.encode(criteria, serviceAccountId)
    function requestVerification(
        address challengeAddress,
        address participant,
        bytes calldata params
    ) external override {
        require(msg.sender == challengeAddress,                         "Caller must be the challenge contract");
        require(!_pendingVerifications[challengeAddress][participant],   "Verification already pending");
        require(bytes(jsSource).length > 0,                            "JS source not configured");

        _pendingVerifications[challengeAddress][participant] = true;
        _storedParams[challengeAddress][participant]         = params;

        bytes32 requestId = _dispatchRequest(challengeAddress, participant, params);
        emit VerificationRequested(challengeAddress, participant, requestId);
    }

    // ── Owner actions ─────────────────────────────────────────────────────────

    // Re-issues the Chainlink request for a (challenge, participant) pair whose
    // previous attempt returned an error. Blocked while a request is still in flight.
    function retryVerification(address challengeAddress, address participant) external onlyOwner {
        require(_pendingVerifications[challengeAddress][participant],            "No pending verification");
        require(_activeRequestId[challengeAddress][participant] == bytes32(0),  "Request still in flight");

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
        (string memory criteria, string memory serviceAccountId) = abi.decode(params, (string, string));

        string[] memory args = new string[](2);
        args[0] = criteria;
        args[1] = serviceAccountId;

        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(jsSource);
        req.setArgs(args);

        requestId = _sendRequest(req.encodeCBOR(), subscriptionId, CALLBACK_GAS_LIMIT, donId);

        _pendingRequests[requestId]                          = PendingRequest(challengeAddress, participant);
        _activeRequestId[challengeAddress][participant]      = requestId;
    }

    // ── Chainlink callback ────────────────────────────────────────────────────

    // Called by the Chainlink router. Response is abi.encode(uint256): 1 = pass, 0 = fail.
    // Must not revert — any revert here would bubble through handleOracleFulfillment
    // and break the Chainlink callback permanently for this requestId.
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

        // Guard against malformed responses to avoid reverting the callback.
        bool passed = response.length >= 32 && abi.decode(response, (uint256)) == 1;

        // Wrap the external call so a reverting challenge cannot break the Chainlink callback.
        // On success: clear pending state (verdict delivered, no retry needed).
        // On failure: leave _pendingVerifications + _storedParams so the owner can retry.
        try IChallenge(pending.challengeAddress).receiveVerdict(pending.participant, passed) {
            delete _pendingVerifications[pending.challengeAddress][pending.participant];
            delete _storedParams[pending.challengeAddress][pending.participant];
            emit VerdictDelivered(pending.challengeAddress, pending.participant, passed, requestId);
        } catch {
            emit VerificationErrored(pending.challengeAddress, pending.participant, requestId, "");
        }
    }
}
