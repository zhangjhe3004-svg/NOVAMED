// Metro 配置：支持 monorepo（解析 workspace 根目录下的 node_modules 与共享包）
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 监听 workspace 根，使 @medicode/shared 等包可被解析
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// 禁用 node 内置模块自动填充，避免与 RN 冲突
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
