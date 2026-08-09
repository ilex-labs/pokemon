import { Route, Routes } from 'react-router-dom'
import Layout from './components/shared/Layout'
import Home from './routes/Home'
import Daycare from './routes/Daycare'
import Postgame from './routes/Postgame'
import NotFound from './routes/NotFound'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="daycare" element={<Daycare />} />
        <Route path="postgame" element={<Postgame />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
