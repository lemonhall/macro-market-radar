# 经纬雷达

一张中文优先的全球宏观市场热力板，覆盖全球股市、美股七姐妹、消费、金融地产、债市、金属、能源、汇率、中美资产、半导体、医疗、军工和经济底盘。

支持安装为 PWA。PWA 只缓存应用外壳，行情接口始终联网读取；断网时可显示浏览器中最近一次成功保存的数据。

## 安装为 PWA

### iPhone 主屏幕

1. 在 iPhone Chrome 中使用设备授权链接打开看板，确认已经正常显示行情。
2. 打开 Chrome 的“分享”菜单，选择“添加到主屏幕”。
3. 保留名称“经纬雷达”并确认添加。
4. 以后直接点击主屏幕上的经纬雷达图标，会以独立窗口启动，不显示浏览器地址栏。

iOS 若在安装时为主屏应用创建了独立的网站数据空间，首次从主屏启动可能需要再打开一次设备授权链接；完成后仍会保持 180 天无感访问。

品牌图标的唯一源文件是 `public/icons/radar-mark.svg`。修改源文件后运行以下命令，可确定性地重新生成 favicon、Apple Touch Icon、普通 PWA 图标和 maskable 图标：

```powershell
npm run generate:icons
```

## 本地启动

```powershell
cd E:\development\macro-market-radar
npm install
npm run dev
```

开发服务器会在本地代理 `/api/market`，不需要单独启动后端。

## 数据与资源策略

- Yahoo Finance Chart：主要市场行情与 1 个月走势。
- 美国财政部：官方 2/10/20/30 年国债收益率曲线、实际利率与通胀补偿。
- 纽约联储与 Fiscal Data：SOFR、逆回购、TGA 和全球供应链压力。
- FRED 定时快照与纽约联储：信用利差、美联储总资产、就业、消费、生产、住房和全球供应链压力。GitHub Actions 每 6 小时检查一次 FRED，只有观测值变化时才触发新部署。
- HYG 与 BDRY：分别作为信用风险和干散货运价的市场代理，界面不会把它们冒充官方利差或 BDI。
- 期限曲线、铜金相对强弱、七姐妹/半导体相对大盘、消费风格和净流动性近似值均由已有数据派生，不增加上游请求。
- 浏览器只请求一个接口，不自动轮询。
- Vercel CDN 缓存 15 分钟，并允许使用 24 小时陈旧数据后台更新。

Yahoo Finance 接口并非官方稳定 API，本项目只做个人只读观察，不用于交易执行。

## 私有访问

生产环境通过 Vercel Routing Middleware 进行设备授权。访问密钥只以 SHA-256 哈希保存在 Vercel，授权链接通过 URL fragment 在浏览器内传递，不会进入服务端访问日志。设备首次授权后使用 180 天的 `HttpOnly` Cookie 无感访问；未授权请求在执行行情函数前返回 404。

### 生成或轮换设备授权链接

以下命令必须在 PowerShell 7 中从项目目录执行。它会生成一枚 256 位随机密钥，只把密钥的 SHA-256 哈希写入 Vercel，并在重新部署后输出设备授权链接：

```powershell
cd E:\development\macro-market-radar

$bytes = [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
$deviceKey = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
$digest = [Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($deviceKey))
$deviceHash = ([Convert]::ToHexString($digest)).ToLowerInvariant()

vercel env add DEVICE_ACCESS_HASH production --value $deviceHash --yes --force --sensitive
if ($LASTEXITCODE -ne 0) { throw '写入 Vercel 设备密钥哈希失败' }

vercel --prod --yes
if ($LASTEXITCODE -ne 0) { throw 'Vercel 生产部署失败' }

$unlockUrl = "https://market.lemonhall.me/unlock.html#$deviceKey"
Write-Output $unlockUrl
```

在每台电脑、手机或每个浏览器中打开一次输出的链接。页面会立即清除地址栏中的 fragment、写入 180 天的 `Secure + HttpOnly + SameSite=Lax` Cookie，然后跳转到看板。

注意事项：

- 不要把 `$deviceKey`、完整授权链接或 Cookie 写入 Git、README、日志、工单或公开聊天。
- Vercel 中只保存 `$deviceHash`；哈希无法直接用于登录。
- URL 中 `#` 后面的 fragment 不会随 HTTP 请求发送到 Vercel，因此不会进入服务端访问日志。
- 轮换 `DEVICE_ACCESS_HASH` 后，所有旧设备 Cookie 会立即失效，需要使用新链接重新授权。
- 180 天到期的是浏览器 Cookie。若密钥未轮换，原授权链接仍可重新授权；若链接遗失或怀疑泄露，执行上述流程生成新链接。
- 清除浏览器站点数据、使用新的浏览器配置或无痕模式，也需要重新打开授权链接。

轮换后可用无 Cookie 请求确认保护仍然生效：

```powershell
$response = Invoke-WebRequest -Uri 'https://market.lemonhall.me/api/market' -SkipHttpErrorCheck
if ($response.StatusCode -ne 404) { throw '匿名访问未被正确拦截' }
```
