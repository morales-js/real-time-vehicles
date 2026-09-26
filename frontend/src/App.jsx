import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import Home from './pages/Home';
import Inventory from './pages/Inventory';
import VehicleDetail from './pages/VehicleDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import PublishVehicle from './pages/PublishVehicle';
import EditVehicle from './pages/EditVehicle';
import MyVehicles from './pages/MyVehicles';
import MyBids from './pages/MyBids';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Públicas (modo lectura) */}
        <Route index element={<Home />} />
        <Route path="inventario" element={<Inventory />} />
        <Route path="vehiculo/:id" element={<VehicleDetail />} />
        <Route path="login" element={<Login />} />
        <Route path="registro" element={<Register />} />
        {/* Requieren sesión */}
        <Route path="publicar" element={<RequireAuth><PublishVehicle /></RequireAuth>} />
        <Route path="mis-publicaciones" element={<RequireAuth><MyVehicles /></RequireAuth>} />
        <Route path="mis-publicaciones/:id/editar" element={<RequireAuth><EditVehicle /></RequireAuth>} />
        <Route path="mis-pujas" element={<RequireAuth><MyBids /></RequireAuth>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
