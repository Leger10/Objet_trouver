import React from 'react';
import { Route, Routes, BrowserRouter as Router } from 'react-router-dom';
import { Toaster } from 'sonner';
import ScrollToTop from './components/ScrollToTop';
import { AuthProvider } from '@/contexts/AuthContext';
import { BrandingProvider } from '@/contexts/BrandingContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import DeclareHubPage from './pages/DeclareHubPage';
import DeclarePage from './pages/DeclarePage';
import DeclarationPage from './pages/DeclarationPage';
import DashboardPage from './pages/DashboardPage';
import LeaderboardPage from './pages/LeaderboardPage';
import PremiumPage from './pages/PremiumPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AdminPage from './pages/AdminPage';
import AdminBrandingPage from './pages/AdminBrandingPage';
import RewardsPage from './pages/RewardsPage';
import PartnersPage from './pages/PartnersPage';
import ProfilePage from './pages/ProfilePage';
import DonatePage from './pages/DonatePage';
import SubscriptionPage from './pages/SubscriptionPage';
import ProAccountsPage from './pages/ProAccountsPage';
import DepositPVPage from './pages/DepositPVPage';
import RestitutionPVPage from './pages/RestitutionPVPage';

function App() {
    return (
        <Router>
            <AuthProvider>
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
                        <Route
                            path="/recompenses"
                            element={
                                <ProtectedRoute redirectTo="/connexion">
                                    <RewardsPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route path="/partenaires" element={<PartnersPage />} />
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
                    </Routes>
                </BrandingProvider>
            </AuthProvider>
        </Router>
    );
}

export default App;
