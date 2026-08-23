import React, { Suspense, lazy, useEffect } from 'react';
import { Route, Routes, BrowserRouter as Router } from 'react-router-dom';
import { Toaster } from 'sonner';
import ScrollToTop from './components/ScrollToTop';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { BrandingProvider } from '@/contexts/BrandingContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { initOneSignal, loginOneSignal, logoutOneSignal, setEmailOneSignal } from '@/lib/onesignal';
import OneSignalVerificationDialog from '@/components/OneSignalVerificationDialog';

function OneSignalSync() {
    const { user, isAuthed } = useAuth();
    useEffect(() => {
        initOneSignal();
    }, []);
    useEffect(() => {
        if (isAuthed && user?.id) {
            loginOneSignal(user.id);
            if (user.email) setEmailOneSignal(user.email);
        } else if (!isAuthed) {
            logoutOneSignal();
        }
    }, [isAuthed, user?.id, user?.email]);
    return <OneSignalVerificationDialog />;
}

const HomePage = lazy(() => import('./pages/HomePage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const DeclareHubPage = lazy(() => import('./pages/DeclareHubPage'));
const DeclarePage = lazy(() => import('./pages/DeclarePage'));
const DeclarationPage = lazy(() => import('./pages/DeclarationPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const PremiumPage = lazy(() => import('./pages/PremiumPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const AdminBrandingPage = lazy(() => import('./pages/AdminBrandingPage'));
const AdminSponsorsPage = lazy(() => import('./pages/AdminSponsorsPage'));
const AdminHeroPage = lazy(() => import('./pages/AdminHeroPage'));
const RewardsPage = lazy(() => import('./pages/RewardsPage'));
const PartnersPage = lazy(() => import('./pages/PartnersPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const DonatePage = lazy(() => import('./pages/DonatePage'));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage'));
const ProAccountsPage = lazy(() => import('./pages/ProAccountsPage'));
const DepositPVPage = lazy(() => import('./pages/DepositPVPage'));
const RestitutionPVPage = lazy(() => import('./pages/RestitutionPVPage'));
const AdminScanPage = lazy(() => import('./pages/AdminScanPage'));
const PVLookupPage = lazy(() => import('./pages/PVLookupPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const SuccessPage = lazy(() => import('./pages/SuccessPage'));
const EditDeclarationPage = lazy(() => import('./pages/EditDeclarationPage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));
const CorrespondancesPage = lazy(() => import('./pages/CorrespondancesPage'));

const PageLoader = () => (
    <div className="flex h-[80dvh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
);

function App() {
    return (
        <Router>
            <ThemeProvider>
            <AuthProvider>
                <OneSignalSync />
                <BrandingProvider>
                    <ScrollToTop />
                    <Toaster
                        position="top-center"
                        toastOptions={{
                            style: {
                                borderRadius: '14px',
                                fontWeight: 600,
                            },
                        }}
                    />
                    <Suspense fallback={<PageLoader />}>
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/rechercher" element={<SearchPage />} />
                        <Route path="/declarer" element={<DeclareHubPage />} />
                        <Route
                            path="/declarer/:kind"
                            element={
                                <ProtectedRoute redirectTo="/connexion">
                                    <DeclarePage />
                                </ProtectedRoute>
                            }
                        />
                        <Route path="/objet/:id" element={<DeclarationPage />} />
                        <Route
                            path="/declarer/modifier/:id"
                            element={
                                <ProtectedRoute redirectTo="/connexion">
                                    <EditDeclarationPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/tableau-de-bord"
                            element={
                                <ProtectedRoute redirectTo="/connexion">
                                    <DashboardPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route path="/classement" element={<LeaderboardPage />} />
                        <Route path="/premium" element={<PremiumPage />} />
                        <Route path="/connexion" element={<LoginPage />} />
                        <Route path="/inscription" element={<SignupPage />} />
                        <Route path="/mot-de-passe-oublie" element={<ForgotPasswordPage />} />
                        <Route path="/reinitialiser-mot-de-passe" element={<ResetPasswordPage />} />
                        <Route path="/mot-de-passe-oublie" element={<ForgotPasswordPage />} />
                        <Route path="/reinitialiser-mot-de-passe" element={<ResetPasswordPage />} />
                        <Route
                            path="/recompenses"
                            element={
                                <ProtectedRoute redirectTo="/connexion">
                                    <RewardsPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route path="/partenaires" element={<PartnersPage />} />
                        <Route path="/success" element={<SuccessPage />} />
                        <Route path="/don" element={<DonatePage />} />
                        <Route path="/abonnement" element={<SubscriptionPage />} />
                        <Route path="/comptes-pro" element={<ProAccountsPage />} />
                        <Route
                            path="/profil"
                            element={
                                <ProtectedRoute redirectTo="/connexion">
                                    <ProfilePage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin"
                            element={
                                <ProtectedRoute redirectTo="/connexion">
                                    <AdminPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin/branding"
                            element={
                                <ProtectedRoute redirectTo="/connexion">
                                    <AdminBrandingPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin/sponsors"
                            element={
                                <ProtectedRoute redirectTo="/connexion">
                                    <AdminSponsorsPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin/hero"
                            element={
                                <ProtectedRoute redirectTo="/connexion">
                                    <AdminHeroPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/pv-depot"
                            element={
                                <ProtectedRoute redirectTo="/connexion">
                                    <DepositPVPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/pv-restitution"
                            element={
                                <ProtectedRoute redirectTo="/connexion">
                                    <RestitutionPVPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/pv/:pvNumber"
                            element={<PVLookupPage />}
                        />
                        <Route
                            path="/admin/scan"
                            element={
                                <ProtectedRoute redirectTo="/connexion">
                                    <AdminScanPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/notifications"
                            element={
                                <ProtectedRoute redirectTo="/connexion">
                                    <NotificationsPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route path="/support" element={<SupportPage />} />
                        <Route
                            path="/mes-correspondances"
                            element={
                                <ProtectedRoute redirectTo="/connexion">
                                    <CorrespondancesPage />
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                    </Suspense>
                </BrandingProvider>
            </AuthProvider>
            </ThemeProvider>
        </Router>
    );
}

export default App;
