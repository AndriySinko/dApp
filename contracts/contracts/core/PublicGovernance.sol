// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../Types.sol";
import "../interfaces/IReputation.sol";
import "../interfaces/ITreasury.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

interface IFactory {
    function createChallenge(
        ChallengeType challengeType,
        VerifierType  verifier,
        string calldata title,
        string calldata criteria,
        uint256 joinDeadline,
        uint256 challengeDeadline,
        uint256 buyIn
    ) external payable returns (address);
}

contract PublicGovernance is Ownable, ReentrancyGuard, AutomationCompatibleInterface {
    using SafeERC20 for IERC20;

    uint256 private constant UPKEEP_FUNDING = 2e18;

    struct Proposal {
        string       title;
        string       description;
        VerifierType verifier;
        uint256      durationDays;
        uint256      joinDays;
        uint256      minStake;
        uint256      votes;
        uint256      voters;
    }

    Proposal[] _proposals;
    uint256    _currentEpoch;
    uint256    _epochEnd;
    uint256    _epochDuration;
    uint256    public prizePerEpoch;

    address[]              _votersThisEpoch;
    mapping(address => bool) _hasVotedThisEpoch;

    address reputationAddress;
    address treasuryAddress;
    address factoryAddress;
    address linkToken;

    event ProposalCreated(
        uint256 indexed proposalIndex,
        string  title,
        string  description,
        VerifierType verifier,
        uint256 durationDays,
        uint256 minStake,
        uint256 epoch
    );

    event Voted(
        address indexed voter,
        uint256 proposalIndex,
        uint256 weight,
        uint256 newVoteCount
    );

    event EpochTicked(
        uint256 epoch,
        uint256 winningProposalIndex,
        string  winningTitle,
        address indexed publicChallengeAddress,
        uint256 prizePool
    );

    event PrizePerEpochUpdated(uint256 newAmount);

    constructor(
        address _reputationAddress,
        address _treasuryAddress,
        address _factoryAddress,
        address _linkToken,
        uint256 epochDuration,
        address initialOwner
    ) Ownable(initialOwner) {
        require(_reputationAddress != address(0), "Zero reputation");
        require(_treasuryAddress   != address(0), "Zero treasury");
        require(_factoryAddress    != address(0), "Zero factory");
        require(_linkToken         != address(0), "Zero link token");

        reputationAddress = _reputationAddress;
        treasuryAddress   = _treasuryAddress;
        factoryAddress    = _factoryAddress;
        linkToken         = _linkToken;
        _epochDuration    = epochDuration;
        _currentEpoch     = 1;
        _epochEnd         = block.timestamp + epochDuration;
    }

    receive() external payable {}

    function setPrizePerEpoch(uint256 amount) external onlyOwner {
        prizePerEpoch = amount;
        emit PrizePerEpochUpdated(amount);
    }

    function propose(
        string calldata title,
        string calldata description,
        VerifierType    verifier,
        uint256         durationDays,
        uint256         joinDays,
        uint256         minStake
    ) external onlyOwner {
        require(bytes(title).length > 0,       "Title required");
        require(bytes(description).length > 0, "Description required");
        require(durationDays > 0,              "Duration must be > 0");
        require(joinDays > 0,                  "Invalid join days");
        require(minStake > 0,                  "Min stake must be > 0");

        _proposals.push(Proposal({
            title:        title,
            description:  description,
            verifier:     verifier,
            durationDays: durationDays,
            joinDays:     joinDays,
            minStake:     minStake,
            votes:        0,
            voters:       0
        }));

        emit ProposalCreated(_proposals.length - 1, title, description, verifier, durationDays, minStake, _currentEpoch);
    }

    function vote(uint256 proposalIndex) external {
        require(block.timestamp < _epochEnd,              "Epoch has ended");
        require(proposalIndex < _proposals.length,        "Invalid proposal index");
        require(!_hasVotedThisEpoch[msg.sender],          "Already voted this epoch");

        int256 rawScore = IReputation(reputationAddress).getScore(msg.sender);
        require(rawScore > 0, "No voting power");
        uint256 weight = uint256(rawScore);

        _proposals[proposalIndex].votes  += weight;
        _proposals[proposalIndex].voters += 1;
        _hasVotedThisEpoch[msg.sender] = true;
        _votersThisEpoch.push(msg.sender);

        emit Voted(msg.sender, proposalIndex, weight, _proposals[proposalIndex].votes);
    }

    function tickEpoch() external nonReentrant {
        require(block.timestamp >= _epochEnd,  "Epoch not ended yet");
        require(_proposals.length > 0,         "No proposals this epoch");
        require(prizePerEpoch > 0,             "Prize pool per epoch not set");
        _tickEpoch();
    }

    function _tickEpoch() internal {
        uint256 pLen = _proposals.length;
        uint256 winningVotes;
        uint256 winningIndex;
        for (uint256 i = 0; i < pLen; i++) {
            if (_proposals[i].votes > winningVotes) {
                winningVotes = _proposals[i].votes;
                winningIndex = i;
            }
        }

        require(winningVotes > 0, "No votes cast this epoch");

        Proposal memory winner = _proposals[winningIndex];

        ITreasury(treasuryAddress).withdrawPrizePool(address(this), prizePerEpoch);
        IERC20(linkToken).forceApprove(factoryAddress, UPKEEP_FUNDING);

        uint256 joinDeadline      = block.timestamp + winner.joinDays * 1 days;
        uint256 challengeDeadline = joinDeadline + winner.durationDays * 1 days;

        address publicChallengeAddress = IFactory(factoryAddress).createChallenge{value: prizePerEpoch}(
            ChallengeType.Public,
            winner.verifier,
            winner.title,
            winner.description,
            joinDeadline,
            challengeDeadline,
            winner.minStake
        );

        IERC20(linkToken).forceApprove(factoryAddress, 0);

        emit EpochTicked(_currentEpoch, winningIndex, winner.title, publicChallengeAddress, prizePerEpoch);

        delete _proposals;
        _currentEpoch += 1;
        _epochEnd = block.timestamp + _epochDuration;

        uint256 vLen = _votersThisEpoch.length;
        for (uint256 i = 0; i < vLen; i++) {
            delete _hasVotedThisEpoch[_votersThisEpoch[i]];
        }
        delete _votersThisEpoch;
    }

    function getProposals() external view returns (Proposal[] memory) {
        return _proposals;
    }

    function hasVotedThisEpoch(address user) external view returns (bool) {
        return _hasVotedThisEpoch[user];
    }

    function getVoteWeight(address user) external view returns (uint256) {
        int256 score = IReputation(reputationAddress).getScore(user);
        return score > 0 ? uint256(score) : 0;
    }

    function currentEpochEnd() external view returns (uint256) {
        return _epochEnd;
    }

    function currentEpoch() external view returns (uint256) {
        return _currentEpoch;
    }

    // ── Chainlink Automation ──────────────────────────────────────────────────

    function checkUpkeep(bytes calldata) external view override returns (bool upkeepNeeded, bytes memory) {
        upkeepNeeded = block.timestamp >= _epochEnd
            && _proposals.length > 0
            && prizePerEpoch > 0;
    }

    function performUpkeep(bytes calldata) external override nonReentrant {
        require(
            block.timestamp >= _epochEnd && _proposals.length > 0 && prizePerEpoch > 0,
            "Upkeep not needed"
        );
        _tickEpoch();
    }
}
