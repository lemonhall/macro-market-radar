# 宏观市场雷达：数据源核验

核验日期：2026-08-21（Asia/Shanghai）

## 结论

建议采用“两条数据管线、一个聚合接口”：

1. 市场行情以 Yahoo Finance 的 `chart` / `spark` JSON 端点为主，覆盖股指、VIX、美元、商品、BTC 和 ETF。
2. 利率、信用和美元流动性指标优先从美国财政部、纽约联储和 FRED 获取；不要用 ETF 价格冒充收益率或信用利差。
3. 浏览器不直接请求这些上游。由一个 Vercel Function 并发取数、标准化后返回单份 JSON，并使用 CDN 缓存。这样既绕开中国大陆访问 Yahoo 的限制，也显著降低函数调用和上游限流风险。

Yahoo 端点并不是面向开发者承诺稳定性的正式 API。实测中国大陆直连返回 Yahoo 地区限制页，同一代理出口的 `query1` chart 端点一度返回 `429 Too Many Requests`；`query2` chart 与不超过 20 个代码的 `query1` spark 请求可用。因此 Yahoo 适合个人看板的低频行情，不应成为不可替代的宏观历史数据库。

## Yahoo Finance 行情

### 已验证端点

- 单标的历史和最新元数据：`https://query2.finance.yahoo.com/v8/finance/chart/{symbol}?range=1mo&interval=1d`
- 多标的轻量快照：`https://query1.finance.yahoo.com/v7/finance/spark?symbols={comma-separated-symbols}&range=5d&interval=1d`

2026-08-21 实测结果：

- 两个端点均不需要 API key 或 cookie。
- `spark` 单次最多 20 个代码；21 个以上返回 `Bad Request: Number of symbols needs to be less than or equal to 20`。
- `query1` 和 `query2` 可能表现不同，且会限流。生产实现应优先用两批 `spark`，失败后按标的回退到 `query2 chart`，并缓存结果。
- `meta.regularMarketTime` 是 Unix 秒；日线的 `timestamp` 也是 Unix 秒。
- 不要依赖数组顺序。`spark.result` 返回顺序与请求顺序可能不同，应以 `symbol` 建立映射。

### 建议标的表

| 分组 | Yahoo 代码 | 含义 | 核验结果 / 注意事项 |
|---|---|---|---|
| 美股 | `^GSPC` | 标普 500 | 可用 |
| 美股 | `^DJI` | 道琼斯工业指数 | 可用 |
| 美股 | `^IXIC` | 纳斯达克综合指数 | 可用 |
| 美股 | `^RUT` | 罗素 2000 | 可用 |
| 波动 | `^VIX` | Cboe VIX | 可用 |
| 美债 | `^FVX` | Cboe 5 年期美债收益率指数 | 可用；接口当前直接返回百分数 |
| 美债 | `^TNX` | Cboe 10 年期美债收益率指数 | 可用；实测值 `4.696`，表示 `4.696%`，不要再除以 10 |
| 美债 | `^TYX` | Cboe 30 年期美债收益率指数 | 可用；不是 20 年期；实测值 `5.237`，表示 `5.237%` |
| 美元 | `DX-Y.NYB` | 美元指数 | 可用；应使用此代码 |
| 美元 | `^DXY` | 不应使用 | 虽可能返回 `result`，但实测类型错误、价格为空 |
| 外汇 | `EURUSD=X` | 欧元兑美元 | 可用 |
| 外汇 | `USDJPY=X` | 美元兑日元 | 可用 |
| 外汇 | `USDCNH=X` | 美元兑离岸人民币 | 可用 |
| 商品 | `GC=F` | COMEX 黄金期货 | 可用；近月连续合约，换月会影响走势 |
| 商品 | `SI=F` | COMEX 白银期货 | 可用；近月连续合约 |
| 商品 | `CL=F` | WTI 原油期货 | 可用；近月连续合约，价格不是现货油价 |
| 商品 | `BZ=F` | 布伦特原油期货 | 可用；近月连续合约 |
| 商品 | `HG=F` | COMEX 铜期货 | 可用 |
| 商品 | `NG=F` | 天然气期货 | 可用 |
| 加密资产 | `BTC-USD` | 比特币兑美元 | 可用；7x24 小时交易，涨跌基准与股票交易日不同 |
| 债券 ETF | `SHY` | 1-3 年期美国国债 ETF | 可用；价格代理，不是收益率 |
| 债券 ETF | `IEF` | 7-10 年期美国国债 ETF | 可用；价格代理，不是收益率 |
| 债券 ETF | `TLT` | 20 年以上美国国债 ETF | 可用；不能替代 20 年期国债收益率 |
| 信用 ETF | `HYG` | 高收益债 ETF | 可用；只能表示风险偏好，不能替代 HY OAS |
| 信用 ETF | `LQD` | 投资级公司债 ETF | 可用；只能表示债券组合价格，不能替代 IG OAS |
| 贵金属 ETF | `GLD` | 黄金 ETF | 可用 |
| 能源 ETF | `USO` | 原油 ETF | 可用；受期货换月和期限结构影响 |
| 行业 ETF | `XLE` | 美国能源行业 ETF | 可用 |
| 半导体 ETF | `SOXX` / `SMH` | 半导体行业 ETF | 均可用，首版选一个即可 |
| 军工 ETF | `ITA` | 美国航空航天与国防 ETF | 可用 |

Yahoo 的 [Finance Search](https://query2.finance.yahoo.com/v1/finance/search?q=MOVE%20Index&quotesCount=10&newsCount=0) 和 [Chart](https://query2.finance.yahoo.com/v8/finance/chart/%5EMOVE?range=1mo&interval=1d) 当前能找到 `^MOVE`，但这仍是未经 SLA 保证的第三方行情，并且 MOVE 是 ICE 的专有指数。可把它做成“可选卡片”：请求失败、时间戳过旧或数值异常时显示“数据暂不可用”，不要用猜测值补齐。

## 官方宏观数据

### 1. 美国国债名义收益率

首选美国财政部的 [Daily Treasury Par Yield Curve Rates](https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve)。无 API key 的 XML 数据：

```text
https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=2026
```

关键字段：`NEW_DATE`、`BC_10YEAR`、`BC_20YEAR`、`BC_30YEAR`。实测 HTTP 200，响应允许跨域（`Access-Control-Allow-Origin: *`），并包含 10、20、30 年三个期限。它是解决“Yahoo 没有可靠 20 年期收益率”的首选。

核验时财政部最新观测为 2026-08-20 的 `4.69% / 5.20% / 5.23%`，而 FRED DGS 当时最新观测仍停在 2026-08-19。这进一步说明财政部应作为曲线主源，FRED 只作回退和历史序列便利层。

FRED 可作为更易解析的 CSV 回退：

| FRED series | 指标 | 频率 | 单位 | 2026-08-21 核验 |
|---|---|---|---|---|
| [`DGS10`](https://fred.stlouisfed.org/series/DGS10) | 10 年期国债市场收益率 | 日 | % | 可用，最新有效观测 2026-08-19 |
| [`DGS20`](https://fred.stlouisfed.org/series/DGS20) | 20 年期国债市场收益率 | 日 | % | 可用，最新有效观测 2026-08-19 |
| [`DGS30`](https://fred.stlouisfed.org/series/DGS30) | 30 年期国债市场收益率 | 日 | % | 可用，最新有效观测 2026-08-19 |

无 key CSV 模板：

```text
https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS20&cosd=2025-01-01
```

`fredgraph.csv` 是 FRED 图表下载端点，并非有版本承诺的正式 FRED API。正式 [FRED API](https://fred.stlouisfed.org/docs/api/fred/series_observations.html) 需要 API key；免 key 请求实测返回 `400` 和 `api_key is not set`。对个人低频看板，CSV 可用；代码仍需把它当作可更换适配器。

不要把所有 FRED series 粗暴塞进同一请求。实测多个不同频率的 series 会返回 ZIP（内含 README 和 CSV），不再是可直接解析的单份 CSV。首版最稳妥的方式是逐 series 并发请求并共享缓存，或严格按相同频率分组。

### 2. 实际利率与通胀预期

美国财政部的 [Daily Treasury Par Real Yield Curve Rates](https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_real_yield_curve) 可通过以下 XML 获取：

```text
https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_real_yield_curve&field_tdr_date_value=2026
```

关键字段为 `TC_5YEAR`、`TC_7YEAR`、`TC_10YEAR`、`TC_20YEAR`、`TC_30YEAR`。实测 HTTP 200。

看板历史序列可直接使用这些 FRED series：

| FRED series | 指标 | 频率 | 单位 | 核验 |
|---|---|---|---|---|
| [`DFII10`](https://fred.stlouisfed.org/series/DFII10) | 10 年期 TIPS 实际利率 | 日 | % | 可用 |
| [`DFII20`](https://fred.stlouisfed.org/series/DFII20) | 20 年期 TIPS 实际利率 | 日 | % | 可用 |
| [`DFII30`](https://fred.stlouisfed.org/series/DFII30) | 30 年期 TIPS 实际利率 | 日 | % | 可用 |
| [`T5YIE`](https://fred.stlouisfed.org/series/T5YIE) | 5 年期盈亏平衡通胀率 | 日 | % | 可用 |
| [`T10YIE`](https://fred.stlouisfed.org/series/T10YIE) | 10 年期盈亏平衡通胀率 | 日 | % | 可用 |
| [`T5YIFR`](https://fred.stlouisfed.org/series/T5YIFR) | 5 年后 5 年远期通胀预期率 | 日 | % | 可用 |

盈亏平衡通胀率包含通胀风险溢价和流动性因素，UI 应称“市场隐含通胀补偿”，不要写成确定的通胀预测。

### 3. 信用利差与金融条件

| FRED series | 指标 | 频率 | 单位 | 用途 |
|---|---|---|---|---|
| [`BAMLH0A0HYM2`](https://fred.stlouisfed.org/series/BAMLH0A0HYM2) | ICE BofA 美国高收益债 OAS | 日 | 百分点 | 信用风险主卡 |
| [`BAMLC0A0CM`](https://fred.stlouisfed.org/series/BAMLC0A0CM) | ICE BofA 美国公司债 Master OAS | 日 | 百分点 | 投资级信用总览 |
| [`BAMLC0A4CBBB`](https://fred.stlouisfed.org/series/BAMLC0A4CBBB) | ICE BofA BBB 公司债 OAS | 日 | 百分点 | 边际信用恶化更敏感 |
| [`NFCI`](https://fred.stlouisfed.org/series/NFCI) | 芝加哥联储国家金融状况指数 | 周 | 指数 | 大于 0 表示金融条件比历史平均更紧，小于 0 表示更松 |

以上四个 series 均已通过 `fredgraph.csv` 实测取回有效观测。OAS 的单位是“百分点”，若 UI 使用基点，应乘以 100，并明确显示 `bp`。

### 4. 利率与美元流动性

| 数据 | 首选来源 | 频率 | 原始单位 | 备注 |
|---|---|---|---|---|
| SOFR | [纽约联储 Markets API](https://markets.newyorkfed.org/static/docs/markets-api.html) | 工作日 | % | 首选一手源；FRED `SOFR` 可回退 |
| 隔夜逆回购 RRP | [纽约联储 Markets API](https://markets.newyorkfed.org/static/docs/markets-api.html) | 操作日 | 美元 | 首选一手源；FRED `RRPONTSYD` 单位为十亿美元 |
| TGA | [美国财政部 Fiscal Data API](https://fiscaldata.treasury.gov/api-documentation/) | 财政部工作日 | 百万美元 | 使用 Daily Treasury Statement 的期末余额 |
| 美联储总资产 | FRED [`WALCL`](https://fred.stlouisfed.org/series/WALCL) | 周 | 百万美元 | 来源为美联储 H.4.1 |
| 有效联邦基金利率 | FRED [`DFF`](https://fred.stlouisfed.org/series/DFF) | 日 | % | 可用于政策利率背景 |

已验证的首选端点：

```text
# SOFR 最新值
https://markets.newyorkfed.org/api/rates/secured/sofr/last/1.json

# 最新一笔逆回购操作结果
https://markets.newyorkfed.org/api/rp/reverserepo/all/results/last/1.json

# TGA 期末余额；page[size] 必须进行 URL 编码
https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance?filter=account_type:eq:Treasury%20General%20Account%20%28TGA%29%20Closing%20Balance&sort=-record_date&page%5Bsize%5D=30
```

实测三个端点均返回 HTTP 200。TGA 返回数据中，名为 `open_today_bal` 的字段承载该行所标识的 TGA closing balance，这是上游表结构的命名结果；实现时必须根据 `account_type` 精确过滤，不能凭字段名猜测含义。

FRED 回退 series：

- `SOFR`：百分比，日频。
- `RRPONTSYD`：十亿美元，日频。
- `WTREGEN`：TGA 周平均，百万美元，周频；它不等于财政部 Daily Treasury Statement 的每日收盘余额。
- `WALCL`：美联储总资产，百万美元，周频。
- `DFF`：有效联邦基金利率，百分比，日频。

如果计算常见的“净流动性近似值”，必须先统一为百万美元：

```text
netLiquidityApprox = WALCL - TGA - RRP * 1000
```

这个值只能标为“近似”，不是官方统计指标。`WALCL` 是周频，TGA 和 RRP 可为日频；展示变化时应统一到最近共同日期或明确标出混合频率，不可把缺失日期做零值处理。

## MOVE 与 BDI 的处理

### MOVE

- Yahoo `^MOVE` 在核验日可返回 ICE BofAML MOVE Index 的日线和最新值。
- 但 MOVE 是 ICE 的专有固定收益指数。[ICE Access & Delivery](https://www.ice.com/fixed-income-data-services/access-and-delivery) 将 API、数据流和历史数据列为客户交付方案；没有找到可依赖的官方、免费、免 key、带稳定性承诺的程序化接口。
- 首版可以使用 Yahoo `^MOVE`，但必须标记来源和更新时间，并允许单卡失败；不要让它拖垮整个聚合接口。
- `^MOVE` 日线实测存在成交量恒为 0、当日 OHLC 异常为 0 的情况。走势图只取有效 `close > 0`；健康检查应拒绝 0 值和过旧时间戳。
- 若 `^MOVE` 长期不可用，可以计算 TLT 的 20 日年化实现波动率，但卡片必须命名为“长债波动代理”，不得命名为 MOVE。

### Baltic Dry Index（BDI）

- Yahoo 搜索没有返回可信的 BDI 指数代码，`^BDI` chart 实测为 `Not Found`。
- Baltic Exchange 的指数数据属于授权数据；其官网分别提供 [API 支持](https://www.balticexchange.com/en/data-services/support/api.html) 与 [数据许可](https://www.balticexchange.com/en/data-services/market-information0/data-licence-.html)，但没有找到满足“官方、免费、免 key、稳定 API”四个条件的来源。
- 首版应明确显示“BDI 暂无可靠免费数据源”，不要抓取网页或接入来历不明的镜像。
- 若产品确实需要航运温度，可另设“代理资产”卡片，例如干散货 ETF，并明确写成“市场代理”，不能命名为 BDI，也不能与指数历史拼接。
- 如果目标其实是观察供应链而非运价本身，可以另加纽约联储[全球供应链压力指数（GSCPI）](https://www.newyorkfed.org/research/policy/gscpi)；它是月频宏观替代指标，同样不能冒充 BDI。

## 取数与缓存建议

### 更新节奏

| 数据组 | 上游刷新 | 建议 CDN 缓存 |
|---|---|---|
| Yahoo 行情、VIX、MOVE | 美股交易时段 5 分钟；盘后 30 分钟 | `s-maxage=300, stale-while-revalidate=3600` |
| BTC | 5 分钟 | `s-maxage=300, stale-while-revalidate=900` |
| 财政部收益率、实际利率、FRED 日频 | 6 小时检查一次 | `s-maxage=21600, stale-while-revalidate=86400` |
| SOFR、RRP、TGA | 6 小时检查一次 | `s-maxage=21600, stale-while-revalidate=86400` |
| NFCI、WALCL 等周频 | 12 小时 | `s-maxage=43200, stale-while-revalidate=172800` |

浏览器页面自身可每 5 分钟重新请求聚合接口；命中 Vercel CDN 时不会重复执行函数。不要使用 Vercel Cron 做分钟级抓取，也不要为每个方块建立单独 API Route。

### 容错契约

聚合接口对每个指标返回独立状态：

```json
{
  "id": "us20y",
  "value": 5.17,
  "unit": "%",
  "asOf": "2026-08-19",
  "source": "USTreasury",
  "status": "ok",
  "stale": false
}
```

实现要求：

1. 单一上游或单一标的失败时返回其他指标，不让整个页面 500。
2. 保留 `asOf`、`source`、`status` 和 `stale`，移动端也能查看更新时间。
3. FRED 的 `.`、Yahoo 的 `null`、MOVE 的 0 值都按缺失处理，不转成数值 0。
4. 所有涨跌幅由同一序列内两个有效收盘值计算，不能混用 `regularMarketPrice` 与不同交易日的基准。
5. 期货、ETF、收益率、利差采用不同单位和颜色逻辑。尤其是收益率或信用利差上升通常代表压力增大，不应机械显示为绿色。

## 最小数据源清单

首版无需接数据库，也不需要付费行情：

- Yahoo：两批 `spark` 加必要时的 `query2 chart` 回退。
- 美国财政部 XML：10/20/30 年名义收益率、实际利率。
- 纽约联储 JSON：SOFR、RRP。
- Fiscal Data JSON：TGA。
- FRED CSV：信用利差、NFCI、美联储资产负债表、通胀预期，以及官方源失败时的回退。

这套组合可以覆盖 PDF 中绝大多数“看大趋势”指标。唯一应诚实留空的是没有可靠免费接口的 BDI；MOVE 可以显示，但只能作为 Yahoo 的非关键可选数据。
