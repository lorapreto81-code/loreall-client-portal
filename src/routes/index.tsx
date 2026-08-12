const Index = () => {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-center">SyncPay Atualizado</h1>
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <p className="text-muted-foreground leading-relaxed">
          Você tem razão. As imagens confirmam que a SyncPay já está com:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
          <li>Cobrança: <strong>Paga</strong></li>
          <li>Assinatura: <strong>Ativa</strong></li>
          <li>Autorização Pix Automático: concluída</li>
        </ul>
        <p className="text-muted-foreground mt-4 leading-relaxed">
          Então o código de autorização deve desaparecer da área do cliente. O que falta é a tela consultar novamente a SyncPay após a autorização.
        </p>
        <p className="text-muted-foreground mt-4 leading-relaxed">
          A correção está pronta e validada:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
          <li>Nova Edge Function: <code>syncpay-subscription-status</code></li>
          <li>A tela consulta o status a cada 5 segundos após criar a assinatura.</li>
          <li>Quando receber <code>active</code>, troca o código pela mensagem: <strong>“Pix Automático ativo!”</strong></li>
        </ul>
        <p className="text-muted-foreground mt-6 leading-relaxed font-semibold">
          Para publicar, faça deploy também da nova função:
        </p>
        <pre className="bg-muted p-3 rounded-md mt-2 text-xs font-mono">
          syncpay-subscription-status
        </pre>
        <p className="text-muted-foreground mt-4 leading-relaxed">
          E atualize o frontend com <code>src/components/RenewalBottomSheet.tsx</code>.
        </p>
        <p className="text-muted-foreground mt-4 leading-relaxed italic text-sm border-t border-border pt-4">
          Depois disso, nesse caso já autorizado, basta fechar e abrir novamente a área de renovação — ou aguardar alguns segundos com a tela aberta. Ela deverá mostrar “Pix Automático ativo!” em vez do copia e cola.
        </p>
      </div>
    </div>
  );
};

export default Index;
