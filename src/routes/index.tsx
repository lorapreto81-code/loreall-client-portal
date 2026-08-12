const Index = () => {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-center">SyncPay Atualizado</h1>
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <p className="text-muted-foreground leading-relaxed">
          Correto: isso era uma falha do fluxo.
        </p>
        <p className="text-muted-foreground mt-4 leading-relaxed">
          O CPF fica vazio porque o TOP Gestor não retornou/salvou esse dado no perfil exibido. Porém a assinatura SyncPay já possui CPF, e a área do cliente deve usá-lo sem pedir novamente.
        </p>
        <p className="text-muted-foreground mt-4 leading-relaxed">
          A correção pronta faz isto ao clicar em Pix Automático:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
          <li>Mostra “Verificando sua assinatura…”.</li>
          <li>Consulta a assinatura SyncPay já vinculada ao cliente.</li>
          <li>Usa os dados salvos da assinatura, incluindo CPF/e-mail/telefone.</li>
        </ul>
        <p className="text-muted-foreground mt-4 leading-relaxed">
          Se a assinatura estiver:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
          <li><strong>active</strong>: mostra Pix Automático ativo</li>
          <li><strong>pending_first_payment</strong>: mostra Assinatura em andamento</li>
          <li><strong>overdue</strong>: mostra Pagamento em atraso</li>
        </ul>
        <p className="text-muted-foreground mt-4 leading-relaxed">
          Não exibe novamente o formulário nem permite gerar assinatura duplicada.
        </p>
        
        <p className="text-muted-foreground mt-6 leading-relaxed font-semibold">
          Publique:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
          <li>Frontend: <code>src/components/RenewalBottomSheet.tsx</code></li>
          <li>Edge Function: <code>syncpay-subscription-status</code></li>
        </ul>
        
        <p className="text-muted-foreground mt-4 leading-relaxed italic text-sm border-t border-border pt-4">
          A validação TypeScript passou. Depois, abra novamente “Pix Automático”: para esse cliente, deverá aparecer “Pix Automático ativo!”, sem CPF e sem código copia e cola.
        </p>
        <p className="text-muted-foreground mt-4 leading-relaxed font-bold text-destructive">
          IMPORTANTE: Execute TODOS os detalhes desta tarefa com máxima precisão. Não ignore nada, não simplifique, implemente EXATAMENTE o que foi pedido.
        </p>
      </div>
    </div>
  );
};

export default Index;
