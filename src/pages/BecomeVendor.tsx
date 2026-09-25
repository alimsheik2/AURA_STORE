import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function BecomeVendor() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    // If user is logged in, send them to signup with vendor role preselected
    // Otherwise, just go to signup where they can choose role
    const target = '/signup' + (user ? '?role=vendor' : '');
    navigate(target);
  }, [navigate, user]);

  return null;
}
