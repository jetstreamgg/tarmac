export default [
  {
    type: 'constructor',
    name: '',
    stateMutability: '',
    constant: false,
    inputs: [
      { type: 'address', name: 'usdsJoin_', simpleType: 'address' },
      { type: 'address', name: 'jug_', simpleType: 'address' },
      { type: 'address', name: 'clip_', simpleType: 'address' },
      { type: 'address', name: 'vow_', simpleType: 'address' }
    ],
    id: '12b8306f-9f34-4651-a558-fcf76354336b'
  },
  {
    type: 'function',
    name: 'convertToShares',
    stateMutability: 'view',
    constant: false,
    inputs: [{ type: 'uint256', name: 'assets', simpleType: 'uint' }],
    outputs: [{ type: 'uint256', name: '', simpleType: 'uint' }],
    id: '0xc6e6f592'
  },
  {
    type: 'function',
    name: 'maxWithdraw',
    stateMutability: 'view',
    constant: false,
    inputs: [{ type: 'address', name: 'owner', simpleType: 'address' }],
    outputs: [{ type: 'uint256', name: '', simpleType: 'uint' }],
    id: '0xce96cb77'
  },
  {
    type: 'function',
    name: 'wards',
    stateMutability: 'view',
    constant: false,
    inputs: [{ type: 'address', name: '', simpleType: 'address' }],
    outputs: [{ type: 'uint256', name: '', simpleType: 'uint' }],
    id: '0xbf353dbb'
  },
  {
    type: 'function',
    name: 'drip',
    stateMutability: 'nonpayable',
    constant: false,
    outputs: [{ type: 'uint256', name: 'nChi', simpleType: 'uint' }],
    id: '0x9f678cca'
  },
  {
    type: 'function',
    name: 'previewRedeem',
    stateMutability: 'view',
    constant: false,
    inputs: [{ type: 'uint256', name: 'shares', simpleType: 'uint' }],
    outputs: [{ type: 'uint256', name: '', simpleType: 'uint' }],
    id: '0x4cdad506'
  },
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    constant: false,
    inputs: [
      { type: 'uint256', name: 'assets', simpleType: 'uint' },
      { type: 'address', name: 'receiver', simpleType: 'address' }
    ],
    outputs: [{ type: 'uint256', name: 'shares', simpleType: 'uint' }],
    id: '0x6e553f65'
  },
  {
    type: 'function',
    name: 'nonces',
    stateMutability: 'view',
    constant: false,
    inputs: [{ type: 'address', name: '', simpleType: 'address' }],
    outputs: [{ type: 'uint256', name: '', simpleType: 'uint' }],
    id: '0x7ecebe00'
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    constant: false,
    inputs: [
      { type: 'address', name: 'to', simpleType: 'address' },
      { type: 'uint256', name: 'value', simpleType: 'uint' }
    ],
    outputs: [{ type: 'bool', name: '', simpleType: 'bool' }],
    id: '0xa9059cbb'
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    constant: false,
    outputs: [{ type: 'uint256', name: '', simpleType: 'uint' }],
    id: '0x18160ddd'
  },
  {
    type: 'function',
    name: 'vat',
    stateMutability: 'view',
    constant: false,
    outputs: [{ type: 'address', name: '', simpleType: 'address' }],
    id: '0x36569e77'
  },
  {
    type: 'function',
    name: 'jug',
    stateMutability: 'view',
    constant: false,
    outputs: [{ type: 'address', name: '', simpleType: 'address' }],
    id: '0x84718d89'
  },
  {
    type: 'function',
    name: 'version',
    stateMutability: 'view',
    constant: false,
    outputs: [{ type: 'string', name: '', simpleType: 'string' }],
    id: '0x54fd4d50'
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    constant: false,
    outputs: [{ type: 'uint8', name: '', simpleType: 'uint' }],
    id: '0x313ce567'
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    constant: false,
    inputs: [
      { type: 'address', name: 'spender', simpleType: 'address' },
      { type: 'uint256', name: 'value', simpleType: 'uint' }
    ],
    outputs: [{ type: 'bool', name: '', simpleType: 'bool' }],
    id: '0x095ea7b3'
  },
  {
    type: 'function',
    name: 'proxiableUUID',
    stateMutability: 'view',
    constant: false,
    outputs: [{ type: 'bytes32', name: '', simpleType: 'bytes' }],
    id: '0x52d1902d'
  },
  {
    type: 'function',
    name: 'cut',
    stateMutability: 'nonpayable',
    constant: false,
    inputs: [{ type: 'uint256', name: 'rad', simpleType: 'uint' }],
    id: '0x09260db7'
  },
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    constant: false,
    inputs: [
      { type: 'uint256', name: 'assets', simpleType: 'uint' },
      { type: 'address', name: 'receiver', simpleType: 'address' },
      { type: 'uint16', name: 'referral', simpleType: 'uint' }
    ],
    outputs: [{ type: 'uint256', name: 'shares', simpleType: 'uint' }],
    id: '0x9b8d6d38'
  },
  {
    type: 'function',
    name: 'permit',
    stateMutability: 'nonpayable',
    constant: false,
    inputs: [
      { type: 'address', name: 'owner', simpleType: 'address' },
      { type: 'address', name: 'spender', simpleType: 'address' },
      { type: 'uint256', name: 'value', simpleType: 'uint' },
      { type: 'uint256', name: 'deadline', simpleType: 'uint' },
      { type: 'bytes', name: 'signature', simpleType: 'bytes' }
    ],
    id: '0x9fd5a6cf'
  },
  {
    type: 'function',
    name: 'ilk',
    stateMutability: 'view',
    constant: false,
    outputs: [{ type: 'bytes32', name: '', simpleType: 'bytes' }],
    id: '0xc5ce281e'
  },
  {
    type: 'function',
    name: 'previewWithdraw',
    stateMutability: 'view',
    constant: false,
    inputs: [{ type: 'uint256', name: 'assets', simpleType: 'uint' }],
    outputs: [{ type: 'uint256', name: '', simpleType: 'uint' }],
    id: '0x0a28a477'
  },
  {
    type: 'function',
    name: 'transferFrom',
    stateMutability: 'nonpayable',
    constant: false,
    inputs: [
      { type: 'address', name: 'from', simpleType: 'address' },
      { type: 'address', name: 'to', simpleType: 'address' },
      { type: 'uint256', name: 'value', simpleType: 'uint' }
    ],
    outputs: [{ type: 'bool', name: '', simpleType: 'bool' }],
    id: '0x23b872dd'
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    constant: false,
    inputs: [
      { type: 'address', name: '', simpleType: 'address' },
      { type: 'address', name: '', simpleType: 'address' }
    ],
    outputs: [{ type: 'uint256', name: '', simpleType: 'uint' }],
    id: '0xdd62ed3e'
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    constant: false,
    inputs: [{ type: 'address', name: '', simpleType: 'address' }],
    outputs: [{ type: 'uint256', name: '', simpleType: 'uint' }],
    id: '0x70a08231'
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    constant: false,
    inputs: [
      { type: 'uint256', name: 'assets', simpleType: 'uint' },
      { type: 'address', name: 'receiver', simpleType: 'address' },
      { type: 'address', name: 'owner', simpleType: 'address' }
    ],
    outputs: [{ type: 'uint256', name: 'shares', simpleType: 'uint' }],
    id: '0xb460af94'
  },
  {
    type: 'function',
    name: 'maxMint',
    stateMutability: 'view',
    constant: false,
    inputs: [{ type: 'address', name: '', simpleType: 'address' }],
    outputs: [{ type: 'uint256', name: '', simpleType: 'uint' }],
    id: '0xc63d75b6'
  },
  {
    type: 'function',
    name: 'deny',
    stateMutability: 'nonpayable',
    constant: false,
    inputs: [{ type: 'address', name: 'usr', simpleType: 'address' }],
    id: '0x9c52a7f1'
  },
  {
    type: 'function',
    name: 'previewDeposit',
    stateMutability: 'view',
    constant: false,
    inputs: [{ type: 'uint256', name: 'assets', simpleType: 'uint' }],
    outputs: [{ type: 'uint256', name: '', simpleType: 'uint' }],
    id: '0xef8b30f7'
  },
  {
    type: 'function',
    name: 'chi',
    stateMutability: 'view',
    constant: false,
    outputs: [{ type: 'uint192', name: '', simpleType: 'uint' }],
    id: '0xc92aecc4'
  },
  {
    type: 'function',
    name: 'vow',
    stateMutability: 'view',
    constant: false,
    outputs: [{ type: 'address', name: '', simpleType: 'address' }],
    id: '0x626cb3c5'
  },
  {
    type: 'function',
    name: 'UPGRADE_INTERFACE_VERSION',
    stateMutability: 'view',
    constant: false,
    outputs: [{ type: 'string', name: '', simpleType: 'string' }],
    id: '0xad3cb1cc'
  },
  {
    type: 'function',
    name: 'clip',
    stateMutability: 'view',
    constant: false,
    outputs: [{ type: 'address', name: '', simpleType: 'address' }],
    id: '0x39b00e41'
  },
  {
    type: 'function',
    name: 'rho',
    stateMutability: 'view',
    constant: false,
    outputs: [{ type: 'uint64', name: '', simpleType: 'uint' }],
    id: '0x20aba08b'
  },
  {
    type: 'function',
    name: 'redeem',
    stateMutability: 'nonpayable',
    constant: false,
    inputs: [
      { type: 'uint256', name: 'shares', simpleType: 'uint' },
      { type: 'address', name: 'receiver', simpleType: 'address' },
      { type: 'address', name: 'owner', simpleType: 'address' }
    ],
    outputs: [{ type: 'uint256', name: 'assets', simpleType: 'uint' }],
    id: '0xba087652'
  },
  {
    type: 'function',
    name: 'upgradeToAndCall',
    stateMutability: 'payable',
    constant: false,
    inputs: [
      { type: 'address', name: 'newImplementation', simpleType: 'address' },
      { type: 'bytes', name: 'data', simpleType: 'bytes' }
    ],
    id: '0x4f1ef286'
  },
  {
    type: 'function',
    name: 'ysr',
    stateMutability: 'view',
    constant: false,
    outputs: [{ type: 'uint256', name: '', simpleType: 'uint' }],
    id: '0xbad10cd8'
  },
  {
    type: 'function',
    name: 'line',
    stateMutability: 'view',
    constant: false,
    outputs: [{ type: 'uint256', name: '', simpleType: 'uint' }],
    id: '0xb56b8353'
  },
  { type: 'function', name: 'initialize', stateMutability: 'nonpayable', constant: false, id: '0x8129fc1c' },
  {
    type: 'function',
    name: 'usdsJoin',
    stateMutability: 'view',
    constant: false,
    outputs: [{ type: 'address', name: '', simpleType: 'address' }],
    id: '0xfa1e2e86'
  },
  {
    type: 'function',
    name: 'getImplementation',
    stateMutability: 'view',
    constant: false,
    outputs: [{ type: 'address', name: '', simpleType: 'address' }],
    id: '0xaaf10f42'
  },
  {
    type: 'function',
    name: 'asset',
    stateMutability: 'view',
    constant: false,
    outputs: [{ type: 'address', name: '', simpleType: 'address' }],
    id: '0x38d52e0f'
  },
  {
    type: 'function',
    name: 'totalAssets',
    stateMutability: 'view',
    constant: false,
    outputs: [{ type: 'uint256', name: '', simpleType: 'uint' }],
    id: '0x01e1d114'
  },
  {
    type: 'function',
    name: 'previewMint',
    stateMutability: 'view',
    constant: false,
    inputs: [{ type: 'uint256', name: 'shares', simpleType: 'uint' }],
    outputs: [{ type: 'uint256', name: '', simpleType: 'uint' }],
    id: '0xb3d7f6b9'
  },
  {
    type: 'function',
    name: 'DOMAIN_SEPARATOR',
    stateMutability: 'view',
    constant: false,
    outputs: [{ type: 'bytes32', name: '', simpleType: 'bytes' }],
    id: '0x3644e515'
  },
  {
    type: 'function',
    name: 'maxRedeem',
    stateMutability: 'view',
    constant: false,
    inputs: [{ type: 'address', name: 'owner', simpleType: 'address' }],
    outputs: [{ type: 'uint256', name: '', simpleType: 'uint' }],
    id: '0xd905777e'
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    constant: false,
    outputs: [{ type: 'string', name: '', simpleType: 'string' }],
    id: '0x95d89b41'
  },
  {
    type: 'function',
    name: 'usds',
    stateMutability: 'view',
    constant: false,
    outputs: [{ type: 'address', name: '', simpleType: 'address' }],
    id: '0x4cf282fb'
  },
  {
    type: 'function',
    name: 'convertToAssets',
    stateMutability: 'view',
    constant: false,
    inputs: [{ type: 'uint256', name: 'shares', simpleType: 'uint' }],
    outputs: [{ type: 'uint256', name: '', simpleType: 'uint' }],
    id: '0x07a2d13a'
  },
  {
    type: 'function',
    name: 'permit',
    stateMutability: 'nonpayable',
    constant: false,
    inputs: [
      { type: 'address', name: 'owner', simpleType: 'address' },
      { type: 'address', name: 'spender', simpleType: 'address' },
      { type: 'uint256', name: 'value', simpleType: 'uint' },
      { type: 'uint256', name: 'deadline', simpleType: 'uint' },
      { type: 'uint8', name: 'v', simpleType: 'uint' },
      { type: 'bytes32', name: 'r', simpleType: 'bytes' },
      { type: 'bytes32', name: 's', simpleType: 'bytes' }
    ],
    id: '0xd505accf'
  },
  {
    type: 'function',
    name: 'maxDeposit',
    stateMutability: 'view',
    constant: false,
    inputs: [{ type: 'address', name: '', simpleType: 'address' }],
    outputs: [{ type: 'uint256', name: '', simpleType: 'uint' }],
    id: '0x402d267d'
  },
  {
    type: 'function',
    name: 'rely',
    stateMutability: 'nonpayable',
    constant: false,
    inputs: [{ type: 'address', name: 'usr', simpleType: 'address' }],
    id: '0x65fae35e'
  },
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    constant: false,
    inputs: [
      { type: 'uint256', name: 'shares', simpleType: 'uint' },
      { type: 'address', name: 'receiver', simpleType: 'address' },
      { type: 'uint16', name: 'referral', simpleType: 'uint' }
    ],
    outputs: [{ type: 'uint256', name: 'assets', simpleType: 'uint' }],
    id: '0x216740a0'
  },
  {
    type: 'function',
    name: 'file',
    stateMutability: 'nonpayable',
    constant: false,
    inputs: [
      { type: 'bytes32', name: 'what', simpleType: 'bytes' },
      { type: 'uint256', name: 'data', simpleType: 'uint' }
    ],
    id: '0x29ae8114'
  },
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    constant: false,
    outputs: [{ type: 'string', name: '', simpleType: 'string' }],
    id: '0x06fdde03'
  },
  {
    type: 'function',
    name: 'cap',
    stateMutability: 'view',
    constant: false,
    outputs: [{ type: 'uint256', name: '', simpleType: 'uint' }],
    id: '0x355274ea'
  },
  {
    type: 'function',
    name: 'PERMIT_TYPEHASH',
    stateMutability: 'view',
    constant: false,
    outputs: [{ type: 'bytes32', name: '', simpleType: 'bytes' }],
    id: '0x30adf81f'
  },
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    constant: false,
    inputs: [
      { type: 'uint256', name: 'shares', simpleType: 'uint' },
      { type: 'address', name: 'receiver', simpleType: 'address' }
    ],
    outputs: [{ type: 'uint256', name: 'assets', simpleType: 'uint' }],
    id: '0x94bf804d'
  },
  {
    type: 'event',
    name: 'Approval',
    stateMutability: '',
    constant: false,
    inputs: [
      { type: 'address', name: 'owner', simpleType: 'address' },
      { type: 'address', name: 'spender', simpleType: 'address' },
      { type: 'uint256', name: 'value', simpleType: 'uint' }
    ],
    id: '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'
  },
  {
    type: 'event',
    name: 'Drip',
    stateMutability: '',
    constant: false,
    inputs: [
      { type: 'uint256', name: 'chi', simpleType: 'uint' },
      { type: 'uint256', name: 'diff', simpleType: 'uint' }
    ],
    id: '0xad1e8a53178522eb68a9d94d862bf30c841f709d2115f743eb6b34528751c79f'
  },
  {
    type: 'event',
    name: 'Initialized',
    stateMutability: '',
    constant: false,
    inputs: [{ type: 'uint64', name: 'version', simpleType: 'uint' }],
    id: '0xc7f505b2f371ae2175ee4913f4499e1f2633a7b5936321eed1cdaeb6115181d2'
  },
  {
    type: 'event',
    name: 'Upgraded',
    stateMutability: '',
    constant: false,
    inputs: [{ type: 'address', name: 'implementation', simpleType: 'address' }],
    id: '0xbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b'
  },
  {
    type: 'event',
    name: 'Rely',
    stateMutability: '',
    constant: false,
    inputs: [{ type: 'address', name: 'usr', simpleType: 'address' }],
    id: '0xdd0e34038ac38b2a1ce960229778ac48a8719bc900b6c4f8d0475c6e8b385a60'
  },
  {
    type: 'event',
    name: 'Transfer',
    stateMutability: '',
    constant: false,
    inputs: [
      { type: 'address', name: 'from', simpleType: 'address' },
      { type: 'address', name: 'to', simpleType: 'address' },
      { type: 'uint256', name: 'value', simpleType: 'uint' }
    ],
    id: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
  },
  {
    type: 'event',
    name: 'Deny',
    stateMutability: '',
    constant: false,
    inputs: [{ type: 'address', name: 'usr', simpleType: 'address' }],
    id: '0x184450df2e323acec0ed3b5c7531b81f9b4cdef7914dfd4c0a4317416bb5251b'
  },
  {
    type: 'event',
    name: 'Deposit',
    stateMutability: '',
    constant: false,
    inputs: [
      { type: 'address', name: 'sender', simpleType: 'address' },
      { type: 'address', name: 'owner', simpleType: 'address' },
      { type: 'uint256', name: 'assets', simpleType: 'uint' },
      { type: 'uint256', name: 'shares', simpleType: 'uint' }
    ],
    id: '0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7'
  },
  {
    type: 'event',
    name: 'Referral',
    stateMutability: '',
    constant: false,
    inputs: [
      { type: 'uint16', name: 'referral', simpleType: 'uint' },
      { type: 'address', name: 'owner', simpleType: 'address' },
      { type: 'uint256', name: 'assets', simpleType: 'uint' },
      { type: 'uint256', name: 'shares', simpleType: 'uint' }
    ],
    id: '0xb30a03a0e2a407f18ae0e83491331dc069d1521e292feffb071e61c8f7f40636'
  },
  {
    type: 'event',
    name: 'File',
    stateMutability: '',
    constant: false,
    inputs: [
      { type: 'bytes32', name: 'what', simpleType: 'bytes' },
      { type: 'uint256', name: 'data', simpleType: 'uint' }
    ],
    id: '0xe986e40cc8c151830d4f61050f4fb2e4add8567caad2d5f5496f9158e91fe4c7'
  },
  {
    type: 'event',
    name: 'Withdraw',
    stateMutability: '',
    constant: false,
    inputs: [
      { type: 'address', name: 'sender', simpleType: 'address' },
      { type: 'address', name: 'receiver', simpleType: 'address' },
      { type: 'address', name: 'owner', simpleType: 'address' },
      { type: 'uint256', name: 'assets', simpleType: 'uint' },
      { type: 'uint256', name: 'shares', simpleType: 'uint' }
    ],
    id: '0xfbde797d201c681b91056529119e0b02407c7bb96a4a2c75c01fc9667232c8db'
  },
  {
    type: 'event',
    name: 'Cut',
    stateMutability: '',
    constant: false,
    inputs: [
      { type: 'uint256', name: 'assets', simpleType: 'uint' },
      { type: 'uint256', name: 'oldChi', simpleType: 'uint' },
      { type: 'uint256', name: 'newChi', simpleType: 'uint' }
    ],
    id: '0xaaa7de6dcd0061e0bcd3a9bb711f1cc6d76b603c4d5cb97901525c7952076406'
  }
] as const;
