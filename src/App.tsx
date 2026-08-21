import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Admin = lazy(() => import("./pages/Admin"));
const Welcome = lazy(() => import("./pages/Welcome"));
const Revendedor = lazy(() => import("./pages/Revendedor"));
const IndicacaoTeste = lazy(() => import("./pages/IndicacaoTeste"));
const Instalacao = lazy(() => import("./pages/Instalacao"));
const NotFound = lazy(() => import("./pages/NotFound"));



const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <CookieConsent />
      <BrowserRouter>
        <Suspense fallback={<div className="flex items-center justify-center h-screen">Carregando...</div>}>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/revendedor" element={<Revendedor />} />
            <Route path="/revendedor/:slug" element={<Revendedor />} />
            <Route path="/indicacao/:code" element={<IndicacaoTeste />} />
            <Route path="/instalacao" element={<Instalacao />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
