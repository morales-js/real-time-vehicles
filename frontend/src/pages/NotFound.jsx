import { Link } from 'react-router-dom';
import { MapPinOff } from 'lucide-react';
import { EmptyState } from '../components/Spinner';

export default function NotFound() {
  return (
    <div className="container">
      <EmptyState icon={MapPinOff} title="Página no encontrada" action={<Link to="/" className="btn btn--primary">Volver al inicio</Link>}>
        La ruta que buscas no existe.
      </EmptyState>
    </div>
  );
}
