import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const ProtectedRoute = ({ children, redirectTo = '/login', reason }) => {
    const { isAuthed } = useAuth();

    if (!isAuthed) {
        const target = reason
            ? `${redirectTo.replace('/login', '/connexion')}?notice=${encodeURIComponent(reason)}`
            : redirectTo;
        return <Navigate to={target} replace />;
    }

    return children;
}

export default ProtectedRoute;

export { ProtectedRoute };
