import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import Welcome from "./pages/Welcome";
import Revendedor from "./pages/Revendedor";
import IndicacaoTeste from "./pages/IndicacaoTeste";

import Instalacao from "./pages/Instalacao";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/revendedor/:slug" element={<Revendedor />} />
          <Route path="/indicacao/:code" element={<IndicacaoTeste />} />
          <Route path="/indicacao" element={<IndicacaoTeste />} />
          <Route path="/links" element={<Navigate to="/" replace />} />
          <Route path="/bio" element={<Navigate to="/" replace />} />
          <Route path="/instalacao" element={<Instalacao />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
