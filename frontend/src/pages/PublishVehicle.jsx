import { useNavigate } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import VehicleForm from '../components/VehicleForm';

export default function PublishVehicle() {
  const navigate = useNavigate();
  const toast = useToast();

  const submit = async (fd) => {
    const { vehicle } = await api('/vehicles', { method: 'POST', form: fd });
    toast.push({ type: 'success', title: '¡Vehículo publicado!', message: `${vehicle.title} ya está en el inventario.` });
    navigate(`/vehiculo/${vehicle.id}`);
  };

  return (
    <div className="container page-narrow">
      <header className="page-head">
        <span className="eyebrow"><PlusCircle size={14} />Nueva publicación</span>
        <h1>Publicar vehículo en subasta</h1>
        <p className="muted">Completa la ficha técnica, clasifica el daño, sube al menos 5 fotos y define el horario de la subasta.</p>
      </header>
      <VehicleForm onSubmit={submit} submitLabel="Publicar vehículo" />
    </div>
  );
}
