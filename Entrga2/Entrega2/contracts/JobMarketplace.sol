// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title JobMarketplace
/// @notice Three-role escrow marketplace inspired by ERC-8183.
///         Client publishes a job and funds it, Provider delivers,
///         Evaluator releases payment or refunds the Client.
///         The Evaluator can be any contract (e.g. a Multisig) capable
///         of calling this contract — `msg.sender == job.evaluator` is
///         the only access check, which makes the protocol composable.
contract JobMarketplace is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error JobNotFound();
    error NotClient();
    error NotProvider();
    error NotEvaluator();
    error InvalidState();
    error JobAlreadyExpired();
    error JobNotExpired();
    error ZeroAddress();
    error ZeroBudget();
    error ProviderAlreadySet();
    error NoProvider();
    error ZeroReason();
    error DeadlineInPast();

    /*//////////////////////////////////////////////////////////////
                                  TYPES
    //////////////////////////////////////////////////////////////*/

    enum JobStatus {
        None,        // 0 - sentinel; jobs[0].status is None until createJob
        Open,        // 1 - created, awaiting provider
        Funded,      // 2 - tokens escrowed
        Submitted,   // 3 - provider delivered
        Completed,   // 4 - evaluator approved, tokens paid to provider
        Rejected,    // 5 - tokens refunded to client
        Expired      // 6 - claimRefund executed after expiry
    }

    struct Job {
        address client;
        address provider;       // zero until setProvider or submit
        address evaluator;
        uint256 budget;
        string  description;
        bytes32 deliverableRef; // set by submit
        JobStatus status;
        uint256 expiresAt;      // unix seconds
    }

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event JobCreated(
        uint256 indexed id,
        address indexed client,
        address indexed evaluator,
        address provider,
        uint256 budget,
        uint256 expiresAt,
        string description
    );
    event ProviderSet(uint256 indexed id, address indexed provider);
    event JobFunded(uint256 indexed id, uint256 amount);
    event JobSubmitted(uint256 indexed id, address indexed provider, bytes32 deliverableRef);
    event JobCompleted(uint256 indexed id, address indexed provider, uint256 amount, bytes32 indexed reason);
    event JobRejected(uint256 indexed id, address indexed client, uint256 amount, bytes32 indexed reason);
    event RefundClaimed(uint256 indexed id, address indexed client, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    IERC20 public immutable token;
    uint256 public nextJobId;
    mapping(uint256 => Job) private _jobs;

    constructor(IERC20 token_) {
        if (address(token_) == address(0)) revert ZeroAddress();
        token = token_;
    }

    /*//////////////////////////////////////////////////////////////
                              VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getJob(uint256 jobId) external view returns (Job memory) {
        return _jobs[jobId];
    }

    function statusOf(uint256 jobId) external view returns (JobStatus) {
        return _jobs[jobId].status;
    }

    /*//////////////////////////////////////////////////////////////
                            CLIENT FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Anyone can publish a Job. provider may be zero and assigned later.
    function createJob(
        string calldata description,
        uint256 budget,
        address evaluator,
        address provider,
        uint256 expiresAt
    ) external returns (uint256 jobId) {
        if (budget == 0) revert ZeroBudget();
        if (evaluator == address(0)) revert ZeroAddress();
        if (expiresAt <= block.timestamp) revert DeadlineInPast();

        jobId = nextJobId++;
        _jobs[jobId] = Job({
            client: msg.sender,
            provider: provider,
            evaluator: evaluator,
            budget: budget,
            description: description,
            deliverableRef: bytes32(0),
            status: JobStatus.Open,
            expiresAt: expiresAt
        });

        emit JobCreated(jobId, msg.sender, evaluator, provider, budget, expiresAt, description);
    }

    /// @notice Client assigns a Provider to an Open Job that has none yet.
    function setProvider(uint256 jobId, address provider) external {
        Job storage j = _jobs[jobId];
        if (j.client == address(0)) revert JobNotFound();
        if (msg.sender != j.client) revert NotClient();
        if (j.status != JobStatus.Open) revert InvalidState();
        if (provider == address(0)) revert ZeroAddress();
        if (j.provider != address(0)) revert ProviderAlreadySet();

        j.provider = provider;
        emit ProviderSet(jobId, provider);
    }

    /// @notice Client escrows `budget` tokens. Token allowance must be set first.
    function fund(uint256 jobId) external nonReentrant {
        Job storage j = _jobs[jobId];
        if (j.client == address(0)) revert JobNotFound();
        if (msg.sender != j.client) revert NotClient();
        if (j.status != JobStatus.Open) revert InvalidState();
        if (j.provider == address(0)) revert NoProvider();
        if (block.timestamp >= j.expiresAt) revert JobAlreadyExpired();

        j.status = JobStatus.Funded;

        token.safeTransferFrom(msg.sender, address(this), j.budget);
        emit JobFunded(jobId, j.budget);
    }

    /*//////////////////////////////////////////////////////////////
                          PROVIDER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Provider delivers a deliverable. deliverableRef is opaque to the chain
    ///         (e.g. keccak256 of an IPFS CID or localStorage key).
    function submit(uint256 jobId, bytes32 deliverableRef) external {
        Job storage j = _jobs[jobId];
        if (j.client == address(0)) revert JobNotFound();
        if (msg.sender != j.provider) revert NotProvider();
        if (j.status != JobStatus.Funded) revert InvalidState();
        if (block.timestamp >= j.expiresAt) revert JobAlreadyExpired();

        j.status = JobStatus.Submitted;
        j.deliverableRef = deliverableRef;

        emit JobSubmitted(jobId, j.provider, deliverableRef);
    }

    /*//////////////////////////////////////////////////////////////
                          EVALUATOR FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Evaluator releases escrow to the Provider. `reason` is an on-chain
    ///         attestation (e.g. keccak256 of the multisig proposal id).
    function complete(uint256 jobId, bytes32 reason) external nonReentrant {
        Job storage j = _jobs[jobId];
        if (j.client == address(0)) revert JobNotFound();
        if (msg.sender != j.evaluator) revert NotEvaluator();
        if (j.status != JobStatus.Submitted) revert InvalidState();
        if (reason == bytes32(0)) revert ZeroReason();

        j.status = JobStatus.Completed;

        uint256 amount = j.budget;
        address payTo = j.provider;
        token.safeTransfer(payTo, amount);

        emit JobCompleted(jobId, payTo, amount, reason);
    }

    /*//////////////////////////////////////////////////////////////
                  REJECTION + REFUND (terminal states)
    //////////////////////////////////////////////////////////////*/

    /// @notice Reject the job and refund the client.
    ///         Open    -> only the Client may reject.
    ///         Funded  -> only the Evaluator may reject.
    ///         Submitted -> only the Evaluator may reject.
    function reject(uint256 jobId, bytes32 reason) external nonReentrant {
        Job storage j = _jobs[jobId];
        if (j.client == address(0)) revert JobNotFound();
        if (reason == bytes32(0)) revert ZeroReason();

        if (j.status == JobStatus.Open) {
            if (msg.sender != j.client) revert NotClient();
            // No funds escrowed yet -> pure state change, no transfer.
            j.status = JobStatus.Rejected;
            emit JobRejected(jobId, j.client, 0, reason);
        } else if (j.status == JobStatus.Funded || j.status == JobStatus.Submitted) {
            if (msg.sender != j.evaluator) revert NotEvaluator();

            j.status = JobStatus.Rejected;
            uint256 amount = j.budget;
            address refundTo = j.client;
            token.safeTransfer(refundTo, amount);

            emit JobRejected(jobId, refundTo, amount, reason);
        } else {
            revert InvalidState();
        }
    }

    /// @notice Anyone may refund the client once the job has expired.
    ///         No access control, no hooks, no reentrancy guard needed because
    ///         status is mutated before the external token transfer.
    ///         `nonReentrant` is kept as a belt-and-suspenders measure because
    ///         token transfers are present; this never breaks permissionless-ness.
    function claimRefund(uint256 jobId) external nonReentrant {
        Job storage j = _jobs[jobId];
        if (j.client == address(0)) revert JobNotFound();
        if (block.timestamp < j.expiresAt) revert JobNotExpired();
        if (j.status != JobStatus.Funded && j.status != JobStatus.Submitted) revert InvalidState();

        j.status = JobStatus.Expired;

        uint256 amount = j.budget;
        address refundTo = j.client;
        token.safeTransfer(refundTo, amount);

        emit RefundClaimed(jobId, refundTo, amount);
    }
}
