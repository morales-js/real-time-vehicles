import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, Pencil } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useNow } from '../utils/clock';
import { phaseOf, isClosedPhase, lot } from '../utils/format';
import VehicleForm from '../components/VehicleForm';
import Spinner, { EmptyState } from '../components/Spinner';

export default function EditVehicle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const now = useNow();
  const [vehicle, setVehicle] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api(`/vehicles/${id}`).then((r) => setVehicle(r.vehicle)).catch((e) => setError(e.message));
  }, [id]);

  const submit = async (fd) => {
    const { vehicle: v } = await api(`/vehicles/${id}`, { method: 'PUT', form: fd });
    toast.push({ type: 'success', title: 'Cambios guardados', message: `${v.title} fue actualizado.` });
    navigate('/mis-publicaciones');
  };

  if (error) return <div className="container"><div className="alert alert--error">{error}</div></div>;
  if (!vehicle) return <Spinner />;
  if (!vehicle.isOwner) {
    return <div className="container"><EmptyState icon={Lock} title="No puedes editar esta publicación" action={<Link className="btn btn--primary" to="/mis-publicaciones">Mis publicaciones</Link>}>Solo el publicador del vehículo puede editarlo.</EmptyState></div>;
  }
  if (isClosedPhase(phaseOf(vehicle, now))) {
    return <div className="container"><EmptyState icon={Lock} title="La subasta ya cerró" action={<Link className="btn btn--primary" to={`/vehiculo/${vehicle.id}`}>Ver resultado</Link>}>Las publicaciones finalizadas no se pueden editar.</EmptyState></div>;
  }

  return (
    <div className="container page-narrow">
      <header className="page-head">
        <Link to="/mis-publicaciones" className="back"><ArrowLeft size={16} />Mis publicaciones</Link>
        <span className="eyebrow"><Pencil size={14} />Editar · Lote {lot(vehicle.id)}</span>
        <h1>{vehicle.title}</h1>
      </header>
      <VehicleForm vehicle={vehicle} onSubmit={submit} submitLabel="Guardar cambios" />
    </div>
  );
}
