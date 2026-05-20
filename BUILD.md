# 简影投屏 - 应用打包指南

## 应用信息

- **应用名称：简影投屏
- **版本**：1.0.0
- **设计风格**：极简黑白灰

## 前置准备

### 1. 图标准备（推荐）

虽然Electron Builder可以直接使用PNG图标，但为了最佳效果，建议：

**macOS**:
```bash
# 使用在线工具转换：
# https://convertio.co/zh/svg-icns/
# 转换后保存为 build/icon.icns
```

**Windows**:
```bash
# 使用在线工具转换：
# https://convertio.co/zh/svg-ico/
# 转换后保存为 build/icon.ico
```

### 2. 安装依赖
```bash
npm install
```

## 构建命令

### macOS 构建
```bash
# 构建当前平台的DMG安装包
npm run electron:build:mac
```

### Windows 构建
```bash
# 构建Windows NSIS安装包
npm run electron:build:win
```

### Linux 构建
```bash
# 构建Linux DEB安装包
npm run electron:build:linux
```

### 自动检测平台构建
```bash
# 自动检测当前平台并构建
npm run electron:build
```

## 构建输出

构建完成后，安装包会生成在 `release/` 目录中。

## 注意事项

1. **首次构建**需要下载Electron二进制文件，可能需要一些时间

2. **macOS签名**：如果需要发布到App Store，需要配置签名证书

3. **Windows签名**：如果需要发布，需要配置代码签名证书

4. **图标降级**：如果没有.icns或.ico文件，Electron Builder会自动使用PNG图标

## 快速测试

先确保开发模式能正常运行：
```bash
npm run electron:dev
```
