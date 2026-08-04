export default function HowItWorksPage() {
  return (
    <div className="page-shell" style={{ maxWidth: 860, marginTop: 32, paddingBottom: 48 }}>
      <h1 style={{ fontWeight: 900 }}>Nasıl Çalışır?</h1>
      <ol style={{ lineHeight: 1.8, fontSize: 16 }}>
        <li>Satıcı üye olur, telefonunu doğrular ve ilan ekler.</li>
        <li>Alıcılar jetonla, admin basamağına uygun tutarda teklif verir.</li>
        <li>Teklifler herkese açıktır; iletişim bilgileri gizli kalır.</li>
        <li>İlan süresi bitince satıcı, süresi dolmamış tekliflerden birini onaylar.</li>
        <li>Onaylanan alıcıya telefon + uygulama içi mesaj açılır.</li>
      </ol>
    </div>
  );
}
