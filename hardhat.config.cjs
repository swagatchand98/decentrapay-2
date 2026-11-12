// Use the npm-pinned compiler so compilation works offline after npm ci.
const { subtask } = require('hardhat/config');
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, TASK_COMPILE_SOLIDITY_RUN_SOLCJS } = require('hardhat/builtin-tasks/task-names');
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD).setAction(async ({ solcVersion }) => ({
  compilerPath: require.resolve('solc/soljson.js'),
  isSolcJs: true,
  version: solcVersion,
  longVersion: require('solc').version(),
}));
subtask(TASK_COMPILE_SOLIDITY_RUN_SOLCJS).setAction(async ({ input }) =>
  JSON.parse(require('solc').compile(JSON.stringify(input))));
module.exports = {
  solidity: { version: '0.8.26', settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris' } },
  networks: { hardhat: { chainId: 31337 } },
};
