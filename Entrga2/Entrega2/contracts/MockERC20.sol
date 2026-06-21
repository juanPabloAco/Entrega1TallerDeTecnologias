// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockERC20
/// @notice Minimal mintable ERC-20 used exclusively in tests and local demos.
/// @dev    decimals() is hardcoded to 6 to mimic stablecoin behavior (e.g. USDC).
contract MockERC20 is ERC20 {
    uint8 private immutable _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// @notice Anyone can mint in this mock. DO NOT use in production.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
