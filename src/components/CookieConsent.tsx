import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, X } from 'lucide-react';

const CookieConsent = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('lgpd_consent');
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const acceptAll = () => {
    localStorage.setItem('lgpd_consent', 'accepted');
    setIsVisible(false);
  };

  const declineAll = () => {
    localStorage.setItem('lgpd_consent', 'declined');
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-4 left-4 right-4 z-[100] md:left-auto md:right-8 md:max-w-md"
        >
          <div className="bg-card/95 backdrop-blur-xl border border-border/60 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-start gap-4">
              <div className="bg-primary/10 p-2.5 rounded-xl">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-foreground text-sm uppercase tracking-wider flex items-center justify-between">
                  Privacidade & Cookies
                  <button onClick={() => setIsVisible(false)} className="text-muted-foreground hover:text-foreground md:hidden">
                    <X className="w-4 h-4" />
                  </button>
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Utilizamos cookies e tecnologias semelhantes para melhorar sua experiência, analisar o tráfego e personalizar conteúdos de acordo com a LGPD. Ao continuar, você concorda com nossa política de privacidade.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-2">
              <Button 
                onClick={acceptAll}
                className="flex-1 btn-primary-gradient text-xs font-bold uppercase tracking-wide h-10"
              >
                Aceitar Tudo
              </Button>
              <Button 
                variant="outline" 
                onClick={declineAll}
                className="flex-1 text-xs font-bold uppercase tracking-wide h-10 border-border/60 hover:bg-accent"
              >
                Recusar
              </Button>
            </div>
            
            <p className="mt-3 text-[10px] text-center text-muted-foreground/60">
              © Loreall Play TV — Conformidade LGPD
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CookieConsent;