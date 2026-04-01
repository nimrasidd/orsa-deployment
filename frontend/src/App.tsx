import * as React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { LoginPage } from "./pages/LoginPage";
import { ReportsPage } from "./pages/ReportsPage";
import { UploadPage } from "./pages/UploadPage";
import { UploadDetail } from "./pages/UploadDetail";
import { MappingsPage } from "./pages/MappingsPage";
import { ModelsPage } from "./pages/ModelsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { CompareDetailPage } from "./pages/CompareDetailPage";
import { NotFound } from "./pages/NotFound";
import { WorkspaceProvider } from "./workspace/tabs";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-sm text-slate-400">Loading…</div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-sm text-slate-400">Loading…</div>
      </div>
    );
  }
  if (!user?.is_admin) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="upload" element={<UploadPage />} />
            <Route
              path="mappings"
              element={
                <AdminRoute>
                  <MappingsPage />
                </AdminRoute>
              }
            />
            <Route path="models" element={<ModelsPage />} />
            <Route
              path="settings"
              element={
                <AdminRoute>
                  <SettingsPage />
                </AdminRoute>
              }
            />
            <Route path="compare/:leftId/:rightId" element={<CompareDetailPage />} />
            <Route path="uploads/:uploadId" element={<UploadDetail />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </WorkspaceProvider>
    </AuthProvider>
  );
}

