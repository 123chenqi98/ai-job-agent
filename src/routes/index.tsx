import { Link, Route, Routes } from 'react-router-dom'
import WorkbenchLayout from '@/layouts/WorkbenchLayout'
import StateView from '@/components/common/StateView'
import Dashboard from '@/pages/Dashboard'
import JobPool from '@/pages/JobPool'
import ApplicationBoard from '@/pages/ApplicationBoard'
import MyResume from '@/pages/MyResume'
import Evaluate from '@/pages/Evaluate'
import BatchEvaluate from '@/pages/Evaluate/BatchEvaluate'
import HistoryPage from '@/pages/Evaluate/HistoryPage'
import AdminUsers from '@/pages/AdminUsers'

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
        <Route path="/evaluate" element={<Evaluate />} />
        <Route path="/evaluate/batch" element={<BatchEvaluate />} />
        <Route path="/evaluate/history" element={<HistoryPage />} />
        <Route path="/resume" element={<MyResume />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
