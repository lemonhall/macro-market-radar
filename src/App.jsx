import { useMemo, useState } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CircleAlert,
  Clock3,
  Coins,
  Crown,
  ExternalLink,
  Factory,
  Fuel,
  Gauge,
  HeartPulse,
  Landmark,
  RefreshCw,
  Shield,
  ShoppingCart,
  TrendingUp,
  X,
} from 'lucide-react'

import { deriveStructureSignals, interpretRegime } from './domain/regime.js'
import { useMarketData } from './hooks/use-market-data.js'

const CATEGORY_ICONS = {
  equity: TrendingUp,
  'megacap-tech': Crown,
  consumer: ShoppingCart,
  'finance-housing': Building2,
  bonds: Landmark,
  metals: Coins,
  energy: Fuel,
  fx: Banknote,
  'china-us': BarChart3,
  semiconductor: Factory,
  healthcare: HeartPulse,
  defense: Shield,
  macro: Gauge,
  economy: BriefcaseBusiness,
}

const CATEGORY_NAMES = {
  equity: '全球股市',
  'megacap-tech': '美股七姐妹',
  consumer: '消费',
  'finance-housing': '金融与地产',
  bonds: '债市与信用',
  metals: '金属',
  energy: '能源',
  fx: '汇率',
  'china-us': '中美温度',
  semiconductor: '半导体',
  healthcare: '医疗',
  defense: '军工',
  macro: '宏观底层',
  economy: '经济底盘',
}

const METRIC_NOTES = {
  vix: '美股期权隐含波动率。快速上升通常意味着短期避险需求增强。',
  move: '美国国债隐含波动率。它反映债市定价的不确定性，不等同于收益率方向。',
  copper: '铜对工业活动与中国需求较敏感，但也会受到供给扰动影响。',
  dxy: '美元相对一篮子主要货币的强弱。快速走强可能对应全球美元流动性收紧。',
  hyg: '高收益债 ETF 的价格代理。下跌可能意味着信用风险溢价扩大。',
  real10y: '美国 10 年通胀保值国债实际收益率，是黄金与长期成长资产的重要定价参考。',
  breakeven10y: '名义国债与通胀保值国债收益率之差，是市场通胀预期的近似代理。',
  nfci: '芝加哥联储金融条件指数。正值通常比历史平均更紧，负值通常更宽松。',
  sofr: '有抵押隔夜融资利率，是美元回购市场的核心基准利率。',
  rrp: '纽约联储隔夜逆回购工具的使用余额。变化需结合 TGA 与美联储资产负债表观察。',
  tga: '美国财政部在美联储的现金余额。快速上升通常意味着财政部从市场抽走现金，但不能单独判断流动性。',
  bdry: '干散货期货策略 ETF，只作为运价市场代理，不是 Baltic Dry Index。',
  btc: '7×24 小时交易的高波动风险资产，常被用于观察边际风险偏好，但关系并不稳定。',
  wmt: '沃尔玛覆盖食品、日用品和可选消费，是观察美国大众购买力与防御型零售需求的代理；股价也会受到利润率、电商和公司自身经营影响。',
  us2y: '美国 2 年期国债收益率对政策利率路径较敏感，与 10 年期收益率共同构成期限曲线。',
  hySpread: 'ICE BofA 美国高收益债期权调整利差。走阔通常意味着信用风险补偿上升。',
  fedAssets: '美联储总资产为周频数据。与 TGA、逆回购结合时只能构造市场常用的流动性近似值。',
  xly: '可选消费行业 ETF，对居民可支配收入、信贷条件与风险偏好较敏感。',
  xlp: '必选消费行业 ETF，通常具有更强防御属性，应与可选消费相对观察。',
  xlf: '美国金融行业 ETF，覆盖银行、保险和资本市场，是利率与信用周期的传导层。',
  kre: '美国区域银行 ETF，对存款成本、商业地产和中小企业信用条件较敏感。',
  xhb: '美国住宅建筑 ETF，对按揭利率、住房需求和建设周期较敏感。',
  joblessClaims: '美国首次申领失业救济人数为周频就业转折指标，单周波动需要结合四周趋势观察。',
  retailSales: '美国 Census Bureau 零售销售的 FRED 序列，月频且可能修订。',
  industrialProduction: '美联储工业生产指数，观察制造业、采矿业与公用事业的实际产出。',
  housingStarts: '美国新屋开工的折年率，月频波动较大，用于确认住房周期。',
  gscpi: '纽约联储全球供应链压力指数。零附近代表历史常态，正值越高通常表示压力越大。',
}

function formatValue(metric) {
  if (!metric.available || !Number.isFinite(metric.value)) return '--'
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: metric.decimals,
    minimumFractionDigits: metric.value < 10 ? Math.min(metric.decimals, 2) : 0,
  }).format(metric.value)
}

function selectedChange(metric, horizon) {
  return horizon === 'day' ? metric.dayChange : metric.monthChange
}

function comparisonLabel(metric, horizon) {
  if (metric.cadence === 'monthly') return '较上期'
  if (horizon === 'day' && metric.cadence === 'weekly') return '较上期'
  return horizon === 'day' ? '较前值' : '近一月'
}

function cadenceLabel(cadence) {
  if (cadence === 'intraday') return '盘中 / 日频'
  if (cadence === 'daily') return '工作日日频'
  if (cadence === 'weekly') return '周频'
  return '月频'
}

function formatChange(metric, horizon) {
  const value = selectedChange(metric, horizon)
  if (!Number.isFinite(value)) return '--'
  const sign = value > 0 ? '+' : ''
  if (metric.changeKind === 'basisPoints') return `${sign}${value.toFixed(1)} bp`
  if (metric.changeKind === 'absolute') return `${sign}${value.toFixed(2)}`
  return `${sign}${value.toFixed(2)}%`
}

function localTime(value, includeTime = true) {
  if (!value) return '未知'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).format(new Date(value))
}

function tileTone(metric, horizon) {
  const change = selectedChange(metric, horizon)
  if (!metric.available || !Number.isFinite(change)) return 'unavailable'
  if (Math.abs(change) < 0.01) return 'flat'
  return change > 0 ? 'up' : 'down'
}

function tileStrength(metric, horizon) {
  const change = Math.abs(selectedChange(metric, horizon) ?? 0)
  const normalized = metric.changeKind === 'basisPoints' ? change / 8 : change
  if (normalized >= 2.5) return 'strong'
  if (normalized >= 0.8) return 'medium'
  return 'soft'
}

function Sparkline({ points, tone = 'flat', large = false }) {
  if (!points?.length) return <div className={`sparkline-empty ${large ? 'large' : ''}`} />
  const width = large ? 620 : 150
  const height = large ? 150 : 34
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const path = points.map((value, index) => {
    const x = (index / Math.max(1, points.length - 1)) * width
    const y = height - 4 - ((value - min) / range) * (height - 8)
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg className={`sparkline ${large ? 'large' : ''}`} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" preserveAspectRatio="none">
      <path d={path} className={`spark-path ${tone}`} />
    </svg>
  )
}

function Freshness({ metric }) {
  const freshness = metric.freshness ?? { key: 'unavailable', label: '暂无数据' }
  return <span className={`freshness freshness-${freshness.key}`}><i />{freshness.label}</span>
}

function MetricTile({ metric, horizon, onOpen }) {
  const tone = tileTone(metric, horizon)
  const strength = tileStrength(metric, horizon)
  const ChangeIcon = tone === 'up' ? ArrowUpRight : ArrowDownRight
  return (
    <button className={`metric-tile tone-${tone} strength-${strength}`} onClick={() => onOpen(metric)}>
      <span className="metric-topline">
        <span className="metric-name">{metric.name}</span>
        <Freshness metric={metric} />
      </span>
      <span className="metric-reading">
        <strong>{formatValue(metric)}</strong>
        <small>{metric.unit}</small>
      </span>
      <span className="metric-move">
        {tone !== 'unavailable' && tone !== 'flat' && <ChangeIcon size={14} />}
        <strong>{formatChange(metric, horizon)}</strong>
        <small>{comparisonLabel(metric, horizon)}</small>
      </span>
      <Sparkline points={metric.points} tone={tone} />
      <span className="metric-footer"><span>{metric.symbol}</span><span>{localTime(metric.asOf, metric.cadence === 'intraday')}</span></span>
    </button>
  )
}

function PulseStrip({ regime }) {
  return (
    <section className="pulse-strip" aria-label="市场状态">
      {regime.pulses.map((pulse) => (
        <article className={`pulse pulse-${pulse.state}`} key={pulse.id}>
          <span>{pulse.label}</span>
          <strong>{pulse.title}</strong>
          <div className="pulse-meter"><i style={{ left: `${(pulse.score + 100) / 2}%` }} /></div>
          <small>强度 {Math.abs(pulse.score)}/100</small>
        </article>
      ))}
    </section>
  )
}

function formatSignalValue(signal) {
  const digits = signal.unit === '万亿美元' ? 2 : 1
  const sign = signal.unit !== '万亿美元' && signal.value > 0 ? '+' : ''
  return `${sign}${signal.value.toFixed(digits)} ${signal.unit}`
}

function StructureStrip({ signals }) {
  return (
    <section className="structure-section" aria-label="结构信号">
      <header><strong>结构信号</strong><span>相对强弱与派生指标</span></header>
      <div className="structure-grid">
        {signals.map((signal) => (
          <article className={`structure-signal signal-${signal.tone}`} key={signal.id}>
            <span>{signal.label}</span>
            <div><strong>{signal.title}</strong><b>{formatSignalValue(signal)}</b></div>
            <small>{signal.detail}</small>
          </article>
        ))}
      </div>
    </section>
  )
}

function QualityLine({ snapshot, loading, error }) {
  if (!snapshot) return null
  const { quality } = snapshot
  return (
    <div className={`quality-line ${error ? 'has-error' : ''}`}>
      {error ? <CircleAlert size={14} /> : <Activity size={14} />}
      <span>{error ? `刷新失败，正在显示上次数据：${error}` : `${quality.available}/${quality.total} 项可用`}</span>
      {quality.stale > 0 && <span>{quality.stale} 项陈旧</span>}
      {quality.unavailable > 0 && <span>{quality.unavailable} 项降级</span>}
      {loading && <span>正在更新…</span>}
    </div>
  )
}

function DetailSheet({ metric, horizon, onClose }) {
  if (!metric) return null
  const tone = tileTone(metric, horizon)
  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="detail-sheet" role="dialog" aria-modal="true" aria-label={`${metric.name}详情`} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><small>{CATEGORY_NAMES[metric.category] ?? metric.category} · {metric.symbol}</small><h2>{metric.name}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="关闭详情" title="关闭"><X size={19} /></button>
        </header>
        <div className="detail-reading">
          <div><strong>{formatValue(metric)}</strong><span>{metric.unit}</span></div>
          <span className={`detail-change change-${tone}`}>{formatChange(metric, horizon)} · {comparisonLabel(metric, horizon)}</span>
        </div>
        <Sparkline points={metric.points} tone={tone} large />
        <div className="detail-facts">
          <div><span>新鲜度</span><Freshness metric={metric} /></div>
          <div><span>数据时点</span><strong>{metric.asOf ? new Date(metric.asOf).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '未知'}</strong></div>
          <div><span>数据来源</span><strong>{metric.source}</strong></div>
          <div><span>更新频率</span><strong>{cadenceLabel(metric.cadence)}</strong></div>
        </div>
        <p className="metric-note">{METRIC_NOTES[metric.id] ?? '该指标用于观察所在市场板块的价格方向与相对强弱，不应单独作为交易结论。'}</p>
        {metric.sourceUrl && <a className="source-link" href={metric.sourceUrl} target="_blank" rel="noreferrer">查看原始来源 <ExternalLink size={14} /></a>}
      </section>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <Activity className="spin" size={24} />
      <strong>正在汇总全球市场</strong>
      <span>读取股债汇、商品与行业信号</span>
    </div>
  )
}

export default function App() {
  const { snapshot, loading, error, refresh } = useMarketData()
  const [horizon, setHorizon] = useState('day')
  const [selectedMetric, setSelectedMetric] = useState(null)

  const regime = useMemo(() => snapshot ? interpretRegime(snapshot.metrics, horizon) : null, [snapshot, horizon])
  const structureSignals = useMemo(
    () => snapshot ? deriveStructureSignals(snapshot.metrics, horizon) : [],
    [snapshot, horizon],
  )
  const grouped = useMemo(() => {
    if (!snapshot) return []
    return snapshot.categories.map((category) => ({
      ...category,
      metrics: snapshot.metrics.filter((metric) => metric.category === category.id),
    })).filter((category) => category.metrics.length > 0)
  }, [snapshot])

  if (!snapshot) return <LoadingScreen />

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Activity size={18} /></span><div><strong>经纬雷达</strong><small>全球市场温度</small></div></div>
        <div className="header-status"><Clock3 size={13} /><span>汇总于 {localTime(snapshot.generatedAt)}</span><b>红涨绿跌</b></div>
        <div className="header-actions">
          <div className="segmented" aria-label="变化周期">
            <button className={horizon === 'day' ? 'active' : ''} onClick={() => setHorizon('day')}>1 日</button>
            <button className={horizon === 'month' ? 'active' : ''} onClick={() => setHorizon('month')}>1 月</button>
          </div>
          <button className="icon-button" onClick={refresh} disabled={loading} aria-label="刷新数据" title="刷新数据"><RefreshCw className={loading ? 'spin' : ''} size={17} /></button>
        </div>
      </header>

      <main>
        <section className="market-summary">
          <div className="summary-copy"><span>当前主导信号</span><h1>{regime.headline}</h1><p>{regime.summary}</p></div>
          <QualityLine snapshot={snapshot} loading={loading} error={error} />
        </section>

        <PulseStrip regime={regime} />
        <StructureStrip signals={structureSignals} />

        <nav className="category-nav" aria-label="市场分类">
          {grouped.map((category) => <a key={category.id} href={`#${category.id}`}>{category.name}</a>)}
        </nav>

        <div className="market-sections">
          {grouped.map((category) => {
            const Icon = CATEGORY_ICONS[category.id] ?? Activity
            return (
              <section className="market-section" id={category.id} key={category.id}>
                <header className="section-header">
                  <div className="section-title"><Icon size={17} /><div><h2>{category.name}</h2><p>{category.description}</p></div></div>
                  <span>{category.metrics.filter((metric) => metric.available).length}/{category.metrics.length}</span>
                </header>
                <div className="metric-grid">
                  {category.metrics.map((metric) => <MetricTile metric={metric} horizon={horizon} onOpen={setSelectedMetric} key={metric.id} />)}
                </div>
              </section>
            )
          })}
        </div>

        <footer>
          <div><Activity size={15} /><strong>数据源状态</strong></div>
          {snapshot.sources.map((source) => <span key={source.name}>{source.name} · {source.cadence}</span>)}
          <p>行情仅供观察，不构成投资建议。休市、节假日和上游延迟会反映在每项新鲜度标记中。</p>
        </footer>
      </main>

      <DetailSheet metric={selectedMetric} horizon={horizon} onClose={() => setSelectedMetric(null)} />
    </div>
  )
}
