import { useEffect, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { WorkbenchDataProvider } from '@/state/WorkbenchStore'
import styles from './WorkbenchLayout.module.css'

// 线性导航图标：1.6 描边、currentColor 继承，无第三方依赖
function IconHome() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
      <path d="M10 20v-5h4v5" />
    </svg>
  )
}

function IconBriefcase() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M3 12h18" />
    </svg>
  )
}

function IconClipboardCheck() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1H9z" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  )
}

function IconKanban() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      <path d="M15 4v7" />
    </svg>
  )
}

function IconResume() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" />
      <path d="M13 3v6h6" />
      <circle cx="12" cy="13.6" r="1.6" />
      <path d="M9.4 18a2.6 2.6 0 0 1 5.2 0" />
    </svg>
  )
}

// 侧边主导航：只放一级模块
const NAV_ITEMS: Array<{ to: string; label: string; icon: () => ReactNode; end?: boolean }> = [
  { to: '/', label: '今日工作台', icon: IconHome, end: true },
  { to: '/jobs', label: '岗位池', icon: IconBriefcase },
  { to: '/evaluate', label: '岗位评估', icon: IconClipboardCheck },
  { to: '/board', label: '投递看板', icon: IconKanban },
  { to: '/resume', label: '我的简历', icon: IconResume },
]

// 顶栏展示「当前所在页」，避免与侧栏品牌名重复
function resolvePageTitle(pathname: string): string {
  if (pathname === '/') return '今日工作台'
  if (pathname === '/jobs') return '岗位池'
  if (pathname.startsWith('/evaluate/batch')) return '批量评估与排名'
  if (pathname.startsWith('/evaluate/history')) return '评估历史'
  if (pathname.startsWith('/evaluate')) return '单岗位评估'
  if (pathname.startsWith('/board')) return '投递看板'
  if (pathname.startsWith('/resume')) return '我的简历'
  return '今日工作台'
}

const APP_TITLE = 'AI 求职决策工作台'

export default function WorkbenchLayout() {
  const location = useLocation()
  const pageTitle = resolvePageTitle(location.pathname)

  // 浏览器标签页标题随路由变化，刷新 / 分享链接时也能识别当前页面
  useEffect(() => {
    document.title = `${pageTitle} · ${APP_TITLE}`
  }, [pageTitle])

  // 数据来源两态：飞书只读两表 / 本机简历（规则解析 + AI 增强）
  const isFeishuConnected =
    location.pathname === '/' ||
    location.pathname === '/jobs' ||
    location.pathname.startsWith('/board')
  const isLocalResume =
    location.pathname === '/resume' || location.pathname.startsWith('/evaluate')

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4l1.7 4.6L18.3 10l-4.6 1.7L12 16.3l-1.7-4.6L5.7 10l4.6-1.4z" />
            </svg>
          </span>
          <span className={styles.brandName}>AI 求职工作台</span>
        </div>
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive
                    ? `${styles.navItem} ${styles.navItemActive}`
                    : styles.navItem
                }
              >
                <span className={styles.navIcon}>
                  <Icon />
                </span>
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
        <div className={styles.sidebarFooter}>
          <span>AI 分析 · 你来决策</span>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <span className={styles.topbarTitle}>{pageTitle}</span>
          <span className={styles.envBadge}>
            <span className={styles.envDot} />
            {isFeishuConnected
              ? '飞书多维表格 · 只读同步'
              : isLocalResume
                ? '本机简历 · 规则解析 + 豆包 AI'
                : 'AI 求职决策工作台'}
          </span>
        </header>
        <section className={styles.content}>
          <WorkbenchDataProvider>
            <Outlet />
          </WorkbenchDataProvider>
        </section>
      </div>
    </div>
  )
}
