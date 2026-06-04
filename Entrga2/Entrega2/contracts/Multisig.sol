// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Multisig
/// @notice Programmatic multisig: stores a list of signers and a threshold.
///         Any signer can propose / approve / execute / cancel.
///         Dynamic signer management (add/remove/changeThreshold) is performed
///         by proposing a transaction that targets the multisig itself with
///         the corresponding function selector. This keeps a single trust path.
contract Multisig {
    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error NotSigner();
    error AlreadyApproved();
    error ThresholdNotMet();
    error AlreadyExecuted();
    error AlreadyCancelled();
    error NotProposer();
    error InvalidThreshold();
    error EmptySigners();
    error DuplicateSigner();
    error OnlyMultisig();
    error ExecutionFailed();
    error ZeroAddress();

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event ProposalCreated(
        uint256 indexed id,
        address indexed proposer,
        address indexed target,
        uint256 value,
        bytes data
    );
    event ProposalApproved(uint256 indexed id, address indexed signer);
    event ProposalExecuted(uint256 indexed id, address indexed executor);
    event ProposalCancelled(uint256 indexed id);
    event SignerAdded(address indexed signer);
    event SignerRemoved(address indexed signer);
    event ThresholdChanged(uint256 newThreshold);
    event Deposit(address indexed from, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                                STRUCTS
    //////////////////////////////////////////////////////////////*/

    struct Proposal {
        address target;
        uint256 value;
        bytes data;
        address proposer;
        uint256 approvalCount;
        bool executed;
        bool cancelled;
        mapping(address => bool) approvals;
    }

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    address[] public signers;
    mapping(address => bool) public isSigner;
    uint256 public threshold;
    uint256 public proposalCount;

    mapping(uint256 => Proposal) private _proposals;

    /*//////////////////////////////////////////////////////////////
                              MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlySigner() {
        if (!isSigner[msg.sender]) revert NotSigner();
        _;
    }

    modifier onlySelf() {
        if (msg.sender != address(this)) revert OnlyMultisig();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(address[] memory _signers, uint256 _threshold) {
        uint256 len = _signers.length;
        if (len == 0) revert EmptySigners();
        if (_threshold == 0 || _threshold > len) revert InvalidThreshold();

        for (uint256 i = 0; i < len; i++) {
            address s = _signers[i];
            if (s == address(0)) revert ZeroAddress();
            if (isSigner[s]) revert DuplicateSigner();
            signers.push(s);
            isSigner[s] = true;
        }
        threshold = _threshold;
    }

    /*//////////////////////////////////////////////////////////////
                            RECEIVE / FALLBACK
    //////////////////////////////////////////////////////////////*/

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    fallback() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    /*//////////////////////////////////////////////////////////////
                              VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getSigners() external view returns (address[] memory) {
        return signers;
    }

    function getProposal(uint256 id)
        external
        view
        returns (
            address target,
            uint256 value,
            bytes memory data,
            address proposer,
            uint256 approvalCount,
            bool executed,
            bool cancelled
        )
    {
        Proposal storage p = _proposals[id];
        return (
            p.target,
            p.value,
            p.data,
            p.proposer,
            p.approvalCount,
            p.executed,
            p.cancelled
        );
    }

    function hasApproved(uint256 id, address account) external view returns (bool) {
        return _proposals[id].approvals[account];
    }

    /*//////////////////////////////////////////////////////////////
                           CORE MULTISIG FLOW
    //////////////////////////////////////////////////////////////*/

    /// @notice Create a new proposal. Only callable by signers.
    /// @return id The new proposal id.
    function propose(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlySigner returns (uint256 id) {
        id = proposalCount;
        proposalCount++;

        Proposal storage p = _proposals[id];
        p.target = target;
        p.value = value;
        p.data = data;
        p.proposer = msg.sender;

        emit ProposalCreated(id, msg.sender, target, value, data);
    }

    /// @notice Approve a proposal. Only callable by signers and only once per signer.
    function approve(uint256 id) external onlySigner {
        Proposal storage p = _proposals[id];
        if (p.executed) revert AlreadyExecuted();
        if (p.cancelled) revert AlreadyCancelled();
        if (p.approvals[msg.sender]) revert AlreadyApproved();

        p.approvals[msg.sender] = true;
        p.approvalCount++;

        emit ProposalApproved(id, msg.sender);
    }

    /// @notice Execute a proposal once threshold is met. Anyone (signer) can trigger.
    function execute(uint256 id) external onlySigner {
        Proposal storage p = _proposals[id];
        if (p.executed) revert AlreadyExecuted();
        if (p.cancelled) revert AlreadyCancelled();
        if (p.approvalCount < threshold) revert ThresholdNotMet();

        p.executed = true;

        (bool ok, ) = p.target.call{value: p.value}(p.data);
        if (!ok) {
            p.executed = false;
            revert ExecutionFailed();
        }

        emit ProposalExecuted(id, msg.sender);
    }

    /// @notice Cancel a proposal. Only the original proposer can cancel.
    function cancel(uint256 id) external {
        Proposal storage p = _proposals[id];
        if (p.executed) revert AlreadyExecuted();
        if (p.cancelled) revert AlreadyCancelled();
        if (p.proposer != msg.sender) revert NotProposer();

        p.cancelled = true;
        emit ProposalCancelled(id);
    }

    /*//////////////////////////////////////////////////////////////
                   DYNAMIC SIGNER MANAGEMENT (onlySelf)
        To use these, propose a transaction targeting `address(this)`
        with the encoded function call as `data`.
    //////////////////////////////////////////////////////////////*/

    function addSigner(address newSigner) external onlySelf {
        if (newSigner == address(0)) revert ZeroAddress();
        if (isSigner[newSigner]) revert DuplicateSigner();

        signers.push(newSigner);
        isSigner[newSigner] = true;
        emit SignerAdded(newSigner);
    }

    function removeSigner(address account) external onlySelf {
        if (!isSigner[account]) revert NotSigner();
        if (signers.length - 1 < threshold) revert InvalidThreshold();

        isSigner[account] = false;
        uint256 len = signers.length;
        for (uint256 i = 0; i < len; i++) {
            if (signers[i] == account) {
                signers[i] = signers[len - 1];
                signers.pop();
                break;
            }
        }
        emit SignerRemoved(account);
    }

    function changeThreshold(uint256 newThreshold) external onlySelf {
        if (newThreshold == 0 || newThreshold > signers.length) revert InvalidThreshold();
        threshold = newThreshold;
        emit ThresholdChanged(newThreshold);
    }
}
