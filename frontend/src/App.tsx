import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { FamiliesProvider } from './context/FamiliesContext';
import { PortalSettingsProvider } from './context/PortalSettingsContext';
import { MainLayout } from './components/layout/MainLayout';
import { Home } from './pages/Home';
import { Catalog } from './pages/Catalog';
import { AssetDetail } from './pages/AssetDetail';
import { AssetDemo } from './pages/AssetDemo';
import { FamilyDetail } from './pages/FamilyDetail';
import { Pipeline } from './pages/Pipeline';
import { PipelineDetail } from './pages/PipelineDetail';
import { Submit } from './pages/Submit';
import { AdminUsers } from './pages/AdminUsers';
import { AuditLog } from './pages/AuditLog';
import { Observability } from './pages/Observability';
import { ExecutiveReports } from './pages/ExecutiveReports';
import { WhyAimplify } from './pages/WhyAimplify';
import { RoleManager } from './pages/RoleManager';
import { PortalSettings } from './pages/PortalSettings';
import { CloneRedeem } from './pages/CloneRedeem';
import { Login } from './pages/Login';
import { AuthCallback } from './pages/AuthCallback';
import { OAuthRedirectHandler } from './components/auth/OAuthRedirectHandler';
import { useAuth } from './context/AuthContext';

function AdminGuard({ children, superAdminOnly = false }: { children: React.ReactNode; superAdminOnly?: boolean }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  const role = user?.role;
  if (superAdminOnly && role !== 'Aimplify.Owner') return <Navigate to="/" replace />;
  if (!superAdminOnly && role !== 'Aimplify.Admin' && role !== 'Aimplify.Owner') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <OAuthRedirectHandler />
      <AuthProvider>
        <PortalSettingsProvider><FamiliesProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            {/* Public — token is the credential, no login required */}
            <Route path="/clone/token/:tokenUuid" element={<CloneRedeem />} />
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Home />} />
              <Route path="catalog" element={<Catalog />} />
              <Route path="catalog/:slug" element={<AssetDetail />} />
              <Route path="catalog/:slug/demo" element={<AssetDemo />} />
              <Route path="family/:id" element={<FamilyDetail />} />
              <Route path="pipeline" element={<Pipeline />} />
              <Route path="pipeline/:id" element={<PipelineDetail />} />
              <Route path="submit" element={<Submit />} />
              <Route path="why" element={<WhyAimplify />} />
              <Route path="admin" element={<AdminGuard superAdminOnly><Observability /></AdminGuard>} />
              <Route path="admin/users" element={<AdminGuard superAdminOnly><AdminUsers /></AdminGuard>} />
              <Route path="admin/audit" element={<AdminGuard superAdminOnly><AuditLog /></AdminGuard>} />
              <Route path="admin/observability" element={<AdminGuard superAdminOnly><Observability /></AdminGuard>} />
              <Route path="admin/reports" element={<AdminGuard superAdminOnly><ExecutiveReports /></AdminGuard>} />
              <Route path="admin/roles" element={<AdminGuard superAdminOnly><RoleManager /></AdminGuard>} />
              <Route path="admin/settings" element={<AdminGuard superAdminOnly><PortalSettings /></AdminGuard>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </FamiliesProvider></PortalSettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
