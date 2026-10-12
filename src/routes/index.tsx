import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import WorkbenchLayout from '@/layouts/WorkbenchLayout'
import StateView from '@/components/common/StateView'
import Dashboard from '@/pages/Dashboard'
import JobPool from '@/pages/JobPool'
import ApplicationBoard from '@/pages/ApplicationBoard'
import MyResume from '@/pages/MyResume'
import BatchEvaluate from '@/pages/Evaluate/BatchEvaluate'
import HistoryPage from '@/pages/Evaluate/HistoryPage'
import TailorPlan from '@/pages/Evaluate/TailorPlan'
import AdminUsers from '@/pages/AdminUsers'

// 旧的单岗位评估入口已下线，统一导向定向简历方案（保留 query 参数以便预填公司/岗位）
function EvaluateRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/evaluate/tailor${search}`} replace />
}

function NotFound() {
  return (
    <StateView
      title="页面不存在"
      description="当前路径没有对应页面，请从下方入口进入岗位池或投递看板。"
      actions={
        <>
          <Link to="/jobs">进入岗位池</Link>
          <Link to="/board">进入投递看板</Link>
        </>
      }
    />
  )
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<WorkbenchLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/jobs" element={<JobPool />} />
        <Route path="/board" element={<ApplicationBoard />} />
        <Route path="/evaluate" element={<EvaluateRedirect />} />
        <Route path="/evaluate/batch" element={<BatchEvaluate />} />
        <Route path="/evaluate/history" element={<HistoryPage />} />
        <Route path="/evaluate/tailor" element={<TailorPlan />} />
        <Route path="/resume" element={<MyResume />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
