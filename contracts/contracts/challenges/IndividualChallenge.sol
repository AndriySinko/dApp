// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./BaseChallenge.sol";
import "../interfaces/IVerifier.sol";
import "../interfaces/IReputation.sol";
import "../interfaces/ITreasury.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract IndividualChallenge is BaseChallenge, ReentrancyGuard {
    uint256 constant MAX_AGAINST_MULTIPLIER  = 5;

    uint256 _forPool;
    uint256 _againstPool;
    uint256 _bettorsFor;
    uint256 _bettorsAgainst;

    struct Bet { uint256 amount; bool side; }
    mapping(address => Bet) bets;
    address[] bettorList;
    mapping(address => uint256) public pendingWithdrawals;

    event BetPlaced(
        address indexed bettor,
        bool    side,
        uint256 amount,
        uint256 newForPool,
        uint256 newAgainstPool,
        uint256 timestamp
    );

    constructor(
        uint256 id,
        address creatorAddr,
        string memory titleStr,
        string memory criteriaStr,
        uint256 joinDl,
        uint256 challengeDl,
        uint256 buyInAmt,
        VerifierType vType,
        address vAddress,
        address repAddress,
        address treasAddress,
        address factoryAddr
    ) payable {
        require(buyInAmt > 0,              "Buy-in must be positive");
        require(msg.value == buyInAmt,     "Must send exact buy-in");
        require(block.timestamp < joinDl,  "Join deadline must be in the future");
        require(joinDl < challengeDl,      "Join deadline must precede challenge deadline");
        require(creatorAddr != address(0), "Zero creator");
        require(vAddress    != address(0), "Zero verifier");
        require(repAddress  != address(0), "Zero reputation");
        require(treasAddress != address(0),"Zero treasury");

        challengeId        = id;
        _creator           = creatorAddr;
        title              = titleStr;
        criteria           = criteriaStr;
        _joinDeadline      = joinDl;
        _challengeDeadline = challengeDl;
        _buyIn             = buyInAmt;
        verifierType       = vType;
        verifierAddress    = vAddress;
        reputationAddress  = repAddress;
        treasuryAddress    = treasAddress;
        _state             = ChallengeState.JoinOpen;
        _factory           = factoryAddr;

        _participants.push(creatorAddr);
        _isRegistered[creatorAddr] = true;
        _stakes[creatorAddr]       = buyInAmt;
        bets[creatorAddr]          = Bet({amount: buyInAmt, side: true});
        _forPool                   = buyInAmt;
        _bettorsFor                = 1;

        emit ParticipantRegistered(creatorAddr, buyInAmt, block.timestamp);
    }

    function _onVerifyPending() internal override {
        try IVerifier(verifierAddress).requestVerification(
            address(this),
            _creator,
            abi.encode(criteria, boundAccount[_creator])
        ) {} catch {}
    }

    function placeBet(bool side) external payable {
        require(_state == ChallengeState.JoinOpen, "Betting closed");
        require(block.timestamp < _joinDeadline, "Join deadline has passed");
        require(!_isRegistered[msg.sender], "Already registered");
        require(msg.value > 0, "Must send ETH");

        if (side) {
            require(msg.value >= _buyIn, "FOR bet below minimum buy-in");
        } else {
            require(
                _againstPool + msg.value <= _buyIn * MAX_AGAINST_MULTIPLIER,
                "AGAINST pool cap reached"
            );
        }

        _participants.push(msg.sender);
        _isRegistered[msg.sender] = true;
        _stakes[msg.sender]       = msg.value;
        bets[msg.sender]          = Bet({amount: msg.value, side: side});
        bettorList.push(msg.sender);

        if (side) {
            _forPool    += msg.value;
            _bettorsFor += 1;
        } else {
            _againstPool    += msg.value;
            _bettorsAgainst += 1;
        }

        emit BetPlaced(msg.sender, side, msg.value, _forPool, _againstPool, block.timestamp);
    }

    function _readyToSettle() internal view override returns (bool) {
        return _verdictReceived[_creator];
    }

    function settle() public override nonReentrant {
        require(_state == ChallengeState.VerifyPending, "Not in VerifyPending");
        require(_verdictReceived[_creator], "Creator verdict not received");

        _state = ChallengeState.Settled;

        if (_verdicts[_creator]) {
            _settleForWins();
        } else {
            _settleAgainstWins();
        }
    }

    function _settleForWins() private {
        uint256 fee       = (_againstPool * 2) / 100;
        uint256 winnerPot = _againstPool - fee;

        if (fee > 0) {
            try ITreasury(treasuryAddress).depositFee{value: fee}() {} catch {}
        }

        uint256 totalDistributed;
        uint256 distributedWinnings;
        uint256 winnersCount;
        uint256 losersCount;

        uint256 pLen = bettorList.length + 1;
        address[] memory repUsers  = new address[](pLen);
        int256[]  memory repDeltas = new int256[](pLen);
        uint256 repCount;

        uint256 creatorWinnings = (_buyIn * winnerPot) / _forPool;
        uint256 creatorPayout   = _buyIn + creatorWinnings;
        pendingWithdrawals[_creator] += creatorPayout;
        totalDistributed     += creatorPayout;
        distributedWinnings  += creatorWinnings;
        winnersCount++;
        emit ParticipantSettled(_creator, true, creatorPayout, int256(creatorWinnings));
        repUsers[repCount] = _creator; repDeltas[repCount] = 100; repCount++;

        for (uint256 i = 0; i < bettorList.length; i++) {
            address p = bettorList[i];
            if (bets[p].side) {
                uint256 winnings = (_stakes[p] * winnerPot) / _forPool;
                uint256 payout   = _stakes[p] + winnings;
                pendingWithdrawals[p] += payout;
                totalDistributed    += payout;
                distributedWinnings += winnings;
                winnersCount++;
                emit ParticipantSettled(p, true, payout, int256(winnings));
                repUsers[repCount] = p; repDeltas[repCount] = 25; repCount++;
            } else {
                losersCount++;
                emit ParticipantSettled(p, false, 0, -int256(_stakes[p]));
            }
        }

        assembly { mstore(repUsers, repCount) mstore(repDeltas, repCount) }
        try IReputation(reputationAddress).batchUpdateRep(repUsers, repDeltas, address(this)) {} catch {}

        // Send integer-division dust to treasury so no ETH is permanently stuck
        uint256 dust = winnerPot - distributedWinnings;
        if (dust > 0) {
            try ITreasury(treasuryAddress).depositFee{value: dust}() {} catch {}
        }

        emit Settled(winnersCount, losersCount, totalDistributed, fee + dust, block.timestamp);
    }

    function _settleAgainstWins() private {
        uint256 fee             = (_forPool * 2) / 100;
        uint256 grossWinnerPot  = _forPool - fee;

        uint256 cappedWinnerPot = grossWinnerPot < _againstPool
            ? grossWinnerPot
            : _againstPool;
        uint256 overflow        = grossWinnerPot - cappedWinnerPot;

        if (fee + overflow > 0) {
            try ITreasury(treasuryAddress).depositFee{value: fee + overflow}() {} catch {}
        }

        uint256 totalDistributed;
        uint256 distributedWinnings;
        uint256 winnersCount;
        uint256 losersCount;

        uint256 pLen = bettorList.length + 1;
        address[] memory repUsers  = new address[](pLen);
        int256[]  memory repDeltas = new int256[](pLen);
        uint256 repCount;

        losersCount++;
        emit ParticipantSettled(_creator, false, 0, -int256(_buyIn));
        repUsers[repCount] = _creator; repDeltas[repCount] = -50; repCount++;

        for (uint256 i = 0; i < bettorList.length; i++) {
            address p = bettorList[i];
            if (!bets[p].side) {
                uint256 winnings = _againstPool > 0
                    ? (_stakes[p] * cappedWinnerPot) / _againstPool
                    : 0;
                uint256 payout   = _stakes[p] + winnings;
                pendingWithdrawals[p] += payout;
                totalDistributed     += payout;
                distributedWinnings  += winnings;
                winnersCount++;
                emit ParticipantSettled(p, true, payout, int256(winnings));
                repUsers[repCount] = p; repDeltas[repCount] = 25; repCount++;
            } else {
                losersCount++;
                emit ParticipantSettled(p, false, 0, -int256(_stakes[p]));
            }
        }

        assembly { mstore(repUsers, repCount) mstore(repDeltas, repCount) }
        try IReputation(reputationAddress).batchUpdateRep(repUsers, repDeltas, address(this)) {} catch {}

        // Send integer-division dust to treasury so no ETH is permanently stuck
        uint256 dust = cappedWinnerPot - distributedWinnings;
        if (dust > 0) {
            try ITreasury(treasuryAddress).depositFee{value: dust}() {} catch {}
        }

        emit Settled(winnersCount, losersCount, totalDistributed, fee + overflow + dust, block.timestamp);
    }

    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        pendingWithdrawals[msg.sender] = 0;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "Transfer failed");
    }

    function forPool()        external view returns (uint256) { return _forPool; }
    function againstPool()    external view returns (uint256) { return _againstPool; }
    function bettorsFor()     external view returns (uint256) { return _bettorsFor; }
    function bettorsAgainst() external view returns (uint256) { return _bettorsAgainst; }

    function getBet(address bettor) external view returns (uint256 amount, bool side) {
        Bet storage b = bets[bettor];
        return (b.amount, b.side);
    }
}
