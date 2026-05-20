# 简影投屏 - 应用图标说明

## 图标设计理念

极简几何风格，体现"简"与"影"：
- 外框 - 投影屏幕边界
- 内部深灰矩形 - 投影区域
- 三条横线 - "简"的抽象表达
- 底部三条线 - 投影光线，代表"影"

## 图标文件

- `icon.svg` - 矢量源文件
- `icon-512.png` - 512x512 PNG版本（SVG格式）

## 图标转换指南

### macOS (生成 .icns)

```bash
# 1. 使用 Preview 或在线工具将 SVG 转换为不同尺寸的 PNG
# 需要: 16, 32, 64, 128, 256, 512 px

# 2. 创建图标集文件夹
mkdir icon.iconset

# 3. 放入各尺寸文件
# icon_16x16.png
# icon_16x16@2x.png
# icon_32x32.png
# icon_32x32@2x.png
# ... 直到 512

# 4. 使用 iconutil 转换
iconutil -c icns icon.iconset
```

### Windows (生成 .ico)

使用在线工具或 GIMP 将 SVG 转换为 ICO 文件。

### 快速方案

使用以下在线工具一键转换：
- https://convertio.co/zh/svg-icns/ (macOS)
- https://convertio.co/zh/svg-ico/ (Windows)
- https://cloudconvert.com/svg-to-png (PNG)

## Electron 构建配置

当前配置已支持直接使用 PNG 图标进行构建，无需转换即可打包。
