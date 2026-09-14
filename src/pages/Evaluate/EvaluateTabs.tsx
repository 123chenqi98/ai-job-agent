import { NavLink } from 'react-router-dom'
import styles from './Evaluate.module.css'

export default function EvaluateTabs() {
  return (
    <div className={styles.tabs}>
      <NavLink
        to="/evaluate"
        end
        className={({ isActive }) =>
          isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
        }
      >
        单岗位评估
      </NavLink>
      <NavLink
        to="/evaluate/batch"
        className={({ isActive }) =>
          isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
        }
      >
        批量评估与排名
      </NavLink>
      <NavLink
        to="/evaluate/history"
        className={({ isActive }) =>
          isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
        }
      >
        历史评估
      </NavLink>
    </div>
  )
}
