import { Link } from 'react-router-dom'
import type { FeishuJobItem } from '@/types/feishu'
import styles from './FeishuJobTable.module.css'

interface FeishuJobTableProps {
  items: FeishuJobItem[]
}

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      className={styles.link}
      href={href}
      target="_blank"
      rel="noreferrer noopener"
    >
      {children} ↗
    </a>
  )
}

export default function FeishuJobTable({ items }: FeishuJobTableProps) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.colCompany}>公司</th>
            <th>招聘岗位</th>
            <th className={styles.colCity}>地点</th>
            <th className={styles.colMeta}>届别</th>
            <th className={styles.colMeta}>学历</th>
            <th className={styles.colDeadline}>网申截止</th>
            <th className={styles.colAction}>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.record_id}>
              <td className={styles.company}>{item.company || '—'}</td>
              <td>
                <div className={styles.jobTitle} title={item.job_title}>
                  {item.job_title || '—'}
                </div>
                {item.recruit_type || item.industry ? (
                  <div className={styles.subMeta}>
                    {[item.recruit_type, item.industry].filter(Boolean).join(' · ')}
                  </div>
                ) : null}
              </td>
              <td className={styles.muted}>{item.city || '—'}</td>
              <td className={styles.muted}>{item.target || '—'}</td>
              <td className={styles.muted}>{item.degree || '—'}</td>
              <td className={`${styles.muted} ${styles.deadline}`}>{item.deadline || '—'}</td>
              <td>
                <div className={styles.links}>
                  <Link
                    className={`${styles.link} ${styles.linkEval}`}
                    to={`/evaluate?company=${encodeURIComponent(item.company || '')}&title=${encodeURIComponent(item.job_title || '')}`}
                  >
                    评估
                  </Link>
                  {item.apply_url ? (
                    <ExternalLink href={item.apply_url}>投递</ExternalLink>
                  ) : null}
                  {item.announcement_url ? (
                    <ExternalLink href={item.announcement_url}>公告</ExternalLink>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
