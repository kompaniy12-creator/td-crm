'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Download, Printer, Save, ChevronDown, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { checkContractReadiness } from '@/lib/contract/requirements'
import { lookupColumn, lookupValue } from '@/lib/utils/lookup'
import type { Deal, Contact } from '@/types'

function pad(n: number) {
  return String(n).padStart(2, '0')
}
function fmtDate(d: Date) {
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

function renderMissingFieldsHtml(dealId: string, missing: { label: string }[]) {
  const items = missing.map((m) => `<li>${m.label}</li>`).join('')
  return `<style>
  .missing-card-wrap { font-family: -apple-system, system-ui, sans-serif; background:#f3f4f6; padding:40px 20px; color:#111; min-height:100vh; }
  .missing-card { max-width:560px; margin:0 auto; background:#fff; border-radius:12px; padding:32px; box-shadow:0 4px 24px rgba(0,0,0,.08); }
  .missing-card h1 { font-size:20px; margin-bottom:8px; color:#b91c1c; }
  .missing-card p { color:#4b5563; line-height:1.5; margin-bottom:16px; }
  .missing-card ul { background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:14px 14px 14px 34px; margin:16px 0; }
  .missing-card li { margin:6px 0; color:#991b1b; font-weight:500; }
  .missing-card .back { display:inline-block; margin-top:12px; padding:10px 18px; background:#2563eb; color:#fff; border-radius:6px; text-decoration:none; font-weight:600; }
  .missing-card .back:hover { background:#1d4ed8; }
  .missing-card .id { font-family: monospace; font-size:11px; color:#9ca3af; margin-top:24px; }
</style>
<div class="missing-card-wrap"><div class="missing-card">
  <h1>⚠️ Договор не может быть сгенерирован</h1>
  <p>Чтобы создать договор, сначала нужно заполнить следующие обязательные поля:</p>
  <ul>${items}</ul>
  <p>Откройте сделку и контакт, заполните недостающие данные и попробуйте снова.</p>
  <a class="back" href="/deals/detail/?id=${dealId}">← Вернуться к сделке</a>
  <div class="id">ID сделки: ${dealId}</div>
</div></div>`
}

function buildContractHtml(deal: Deal, contact: Contact | null) {
  const meta = (deal.metadata || {}) as Record<string, string>
  const today = new Date()
  const dateStr = fmtDate(today)
  // Prefer the short user-facing number for the contract heading.
  const contractNo = deal.number ? String(deal.number) : String(deal.id)

  const clientName = contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(' ')
    : deal.title || '___'
  const clientAddress = contact
    ? [contact.address, contact.city, contact.country].filter(Boolean).join(', ') || '___'
    : meta.address || '___'
  const passportNo = contact
    ? [contact.passport_series, contact.passport_number].filter(Boolean).join(' ') || '___'
    : meta.passport || '___'
  const clientPhone = contact?.phone || '___'
  const clientEmail = contact?.email || '___'

  const serviceType = meta.service_type || '___'
  const totalAmount = deal.amount ? `${deal.amount.toLocaleString('pl-PL')}` : '___'
  const prepaymentAmount = meta.prepayment_amount || '___'
  const prepaymentDate = meta.prepayment_date || '___'
  const secondPayment = meta.second_payment || '___'
  const secondPaymentDate = meta.second_payment_date || '___'

  const v = (val: string) => `<strong>${val}</strong>`

  return `<style>
  .contract-body * { margin: 0; padding: 0; box-sizing: border-box; }
  .contract-body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 12pt;
    line-height: 1.6;
    color: #000;
    background: #eee;
    padding: 30px 20px;
    min-height: 100vh;
  }
  .contract-body .page {
    max-width: 800px;
    margin: 0 auto;
    background: #fff;
    padding: 70px 80px;
    box-shadow: 0 2px 20px rgba(0,0,0,.15);
    min-height: 1100px;
  }
  .contract-body h1 {
    font-size: 14pt;
    font-weight: bold;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 18px;
  }
  .contract-body .meta { text-align: center; margin-bottom: 20px; font-size: 11.5pt; }
  .contract-body p { margin-bottom: 10px; font-size: 11.5pt; }
  .contract-body .section-title { font-weight: bold; text-align: center; margin: 22px 0 8px; font-size: 12pt; }
  .contract-body ol { padding-left: 22px; margin: 6px 0 10px; }
  .contract-body ol li { margin-bottom: 6px; font-size: 11.5pt; }
  .contract-body ol.alpha { list-style-type: lower-alpha; }
  .contract-body .signatures { margin-top: 60px; display: flex; justify-content: space-between; }
  .contract-body .sig { width: 45%; text-align: center; }
  .contract-body .sig-line { border-top: 1px solid #000; margin-top: 50px; padding-top: 6px; font-size: 10pt; }
  .contract-body .clause-info { margin-top: 40px; }
  .contract-body .clause-info h2 { font-size: 12pt; font-weight: bold; text-align: center; margin-bottom: 12px; }
  .contract-body .consent-block { margin-top: 30px; border-top: 1px solid #000; padding-top: 12px; }
  .contract-body .consent-block ul { padding-left: 20px; margin: 10px 0; }
  .contract-body .consent-block ul li { margin-bottom: 8px; list-style-type: disc; font-size: 11.5pt; }
  .contract-body .final-sig { margin-top: 40px; text-align: right; }
  @media print {
    .contract-toolbar { display: none !important; }
    body { background: #fff !important; }
    .contract-body { background: #fff; padding: 0; }
    .contract-body .page { box-shadow: none; padding: 50px 60px; }
    @page { margin: 15mm; }
  }
</style>
<div class="contract-body">
<div class="page">
<h1>UMOWA O ŚWIADCZENIE USŁUG</h1>
<div class="meta">
  <p>numer ${v(contractNo)}&nbsp;&nbsp; z dnia ${v(dateStr)}, zawarta w Poznaniu,</p>
  <p>zwana dalej „Umową",</p>
  <p>zawarta pomiędzy:</p>
</div>
<p>TWOJA DECYZJA SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ, z siedzibą w Poznaniu, 61-819 ul. Stanisława Taczaka 24/301, zarejestrowaną w rejestrze przedsiębiorców Krajowego Rejestru Sądowego prowadzonym przez SĄD REJONOWY POZNAŃ – NOWE MIASTO I WILDA W POZNANIU, VIII WYDZIAŁ GOSPODARCZY KRAJOWEGO REJESTRU SĄDOWEGO, pod numerem KRS 0001199573, o numerze NIP 7831938936, reprezentowaną przez Hanna Kriierenko – Członka Zarządu</p>
<p>zwanym dalej Zleceniobiorcą,</p>
<p style="text-align:center"><strong>a</strong></p>
<p>${v(clientName)}, zamieszkały(ą) przy ${v(clientAddress)}, legitymujący(a) się paszportem o numerze ${v(passportNo)}</p>
<p>zwanym dalej Zleceniodawcą,</p>
<p>zwanych łącznie „Stronami", a osobno „Stroną", o następującej treści:</p>

<p class="section-title">§ 1<br>Przedmiot umowy</p>
<p>1. Przedmiotem niniejszej Umowy jest świadczenie przez Zleceniobiorcę na rzecz Zleceniodawcy usług mających na celu obsługę w celu uzyskania legalizacji pobytu w Rzeczypospolitej Polskiej, a w szczególności:</p>
<ol>
  <li>analiza dokumentów niezbędnych do uzyskania zezwolenia na ${v(serviceType)};</li>
  <li>przygotowanie dokumentów niezbędnych do uzyskania zezwolenia na ${v(serviceType)};</li>
  <li>pomóc w złożeniu dokumentów niezbędnych do uzyskania zezwolenia na ${v(serviceType)};</li>
  <li>rejestracja na złożenie odcisków oraz odbiór karty pobytu wydanej w Poznaniu;</li>
  <li>prowadzenie sprawy do uzyskania decyzji w sprawie o udzielenie zezwolenia na ${v(serviceType)};</li>
</ol>
<p>zwanych dalej „Usługami".</p>
<p>2. Zleceniobiorca będzie wykonywać obowiązki wynikające z niniejszej Umowy w dowolnym miejscu, umożliwiającym mu wykonywanie Usług zgodnie z postanowieniami niniejszej Umowy.</p>

<p class="section-title">§ 2<br>Obowiązki Zleceniobiorcy</p>
<ol>
  <li>Zleceniobiorca oświadcza, że posiada wszelkie niezbędne kwalifikacje i doświadczenie, gwarantujące prawidłowe wykonanie przedmiotu Umowy i nie istnieją żadne przeszkody prawne i faktyczne uniemożliwiające lub utrudniające mu wykonywanie obowiązków, o których mowa w § 1 ust. 1 Umowy.</li>
  <li>Zleceniobiorca będzie świadczyć Usługi opisane w § 1 ust. 1 Umowy z należytą starannością, zgodnie z najlepszymi praktykami przyjętymi przy świadczeniu usług tego rodzaju.</li>
  <li>Zleceniobiorca może posługiwać się przy wykonywaniu Umowy osobami trzecimi posiadającymi odpowiednie kwalifikacje i przygotowanie merytoryczne.</li>
  <li>Zleceniobiorca zobowiązany jest realizować przedmiot Umowy zgodnie z powszechnie przyjętymi standardami oraz zapewniając wysoki poziom świadczonych usług.</li>
  <li>Zleceniobiorca ma prawo do podzlecania wykonania całości lub części przedmiotu Umowy innym podmiotom.</li>
  <li>Zleceniobiorca, wykonuje Usługi na własnym sprzęcie (m.in. komputer), koniecznym do należytego wykonywania zleconych Usług. Zleceniobiorca jest odpowiedzialny za zapewnienie prawidłowego działania sprzętu w trakcie wykonywania zleconych mu Usług.</li>
</ol>

<p class="section-title">§ 3<br>Prawa i Obowiązki Zleceniodawcy</p>
<ol>
  <li>Zleceniodawca zobowiązuje się dostarczać Zleceniobiorcy wszelkie informacje oraz dokumenty niezbędne do prawidłowego wykonywania Usług.</li>
  <li>Zleceniodawca zobowiązuje się współpracować ze Zleceniobiorcą przy wykonywaniu Usług, w szczególności udzielić mu dostępu do wszelkich niezbędnych dokumentów i informacji niezbędnych do wykonywania Usług.</li>
  <li>Zleceniodawca ma prawo do oceny i kontroli świadczenia usług objętych Umową na każdym etapie jej realizacji.</li>
  <li>Zleceniodawca zobowiązuje się dostarczać kompletne i prawdziwe informacje oraz dokumenty wymagane do realizacji Usług, w terminie wskazanym przez Zleceniobiorcę. W przypadku opóźnienia w dostarczeniu dokumentów lub podania nieprawdziwych danych, Zleceniobiorca uprawniony jest do wstrzymania realizacji Umowy bez konsekwencji finansowych.</li>
  <li>Zleceniodawca zobowiązany jest do niezwłocznego informowania Zleceniobiorcy o wszelkich zmianach mających wpływ na realizację niniejszej Umowy, w szczególności zmianie adresu zamieszkania, pracodawcy, stanu cywilnego, numeru telefonu, adresu e-mail, dokumentów tożsamości lub innych danych istotnych dla prowadzonego postępowania. Brak poinformowania Zleceniobiorcy o powyższych zmianach zwalnia go z odpowiedzialności za ewentualne negatywne skutki w postępowaniu administracyjnym.</li>
</ol>

<p class="section-title">§ 4<br>Wynagrodzenie i płatność</p>
<ol>
  <li>Zleceniobiorcy za wykonywanie czynności określonych w § 1 Umowy przysługuje wynagrodzenie w wysokości ${v(totalAmount)} zł, płatne w następujący sposób:
    <ol class="alpha" style="margin-top:6px">
      <li>${v(prepaymentAmount)} złotych brutto, płatne w dniu ${v(prepaymentDate)}</li>
      <li>${v(secondPayment)} złotych brutto, płatne w dniu ${v(secondPaymentDate)}</li>
    </ol>
  </li>
  <li>Wynagrodzenie, o którym mowa w ust. 1, płatne będzie gotówką lub przelewem na rachunek bankowy: <strong>16 1140 2004 0000 3602 8615 9578</strong> lub przelewem BLIK na numer telefonu <strong>608 032 323</strong>. Zleceniobiorca wystawi Zleceniodawcy paragon potwierdzający zapłatę.</li>
  <li>Za dzień dokonania zapłaty uznaje się dzień uznania rachunku bankowego Zleceniobiorcy.</li>
  <li>W przypadku wydania decyzji odmownej z winy Zleceniobiorcy, Zleceniobiorca zobowiązuje się do zwrotu 100% otrzymanego wynagrodzenia za osobę, której dotyczy decyzja odmowna, wyłącznie w przypadku gdy po wniesieniu odwołania od decyzji odmownej nie uda się pozytywnie zakończyć sprawy.</li>
  <li>Zleceniobiorca nie ponosi odpowiedzialności za negatywny wynik postępowania administracyjnego w sytuacji, gdy wynika on z przyczyn niezależnych od Zleceniobiorcy, w szczególności: braków formalnych lub prawnych po stronie Zleceniodawcy, nieprawdziwych lub niekompletnych danych przekazanych przez Zleceniodawcę, jak również zmiany przepisów prawa w trakcie trwania Umowy.</li>
  <li>W przypadku odstąpienia od Umowy przez Zleceniodawcę po rozpoczęciu świadczenia Usług, wniesiona przedpłata nie podlega zwrotowi. Zwrotowi podlega jedynie ta część wynagrodzenia, która nie odpowiada czynnościom już wykonanym przez Zleceniobiorcę.</li>
</ol>

<p class="section-title">§ 5<br>Rozwiązanie</p>
<ol>
  <li>Strony są uprawnione do wypowiedzenia niniejszej Umowy na piśmie w każdym czasie, w drodze porozumienia. Jeśli Strony nie postanowią inaczej, Zleceniodawca powinien jednak zwrócić Zleceniobiorcy wydatki, które ten poczynił w celu należytego wykonania zlecenia oraz część wynagrodzenia odpowiadającego jego dotychczasowym czynnościom, a jeżeli wypowiedzenie nastąpiło bez ważnego powodu, powinien także naprawić szkodę.</li>
  <li>Każda ze Stron jest uprawniona do wypowiedzenia niniejszej Umowy za jednomiesięcznym okresem wypowiedzenia, ze skutkiem na koniec następnego miesiąca kalendarzowego, dokonanego w formie pisemnej, pod rygorem nieważności.</li>
  <li>Zleceniobiorca jest uprawniony do rozwiązania niniejszej Umowy, bez wypowiedzenia, w przypadku:
    <ol class="alpha" style="margin-top:6px">
      <li>niepodania przez Zleceniodawcy danych niezbędnych do wykonania niniejszej Umowy, w tym danych kontaktowych czy też uniemożliwiających wyznaczenie terminu wykonania Usług,</li>
      <li>nie udzielenia pełnomocnictwa Zleceniobiorcy przez Zleceniodawcę,</li>
      <li>braku kooperacji Zleceniodawcy w trakcie obowiązywania Umowy,</li>
      <li>wykraczania przez Zleceniodawcę w sposób uporczywy przeciwko porządkowi i zasadom współżycia społecznego w miejscu wykonywania Usług,</li>
      <li>uniemożliwienia przez Zleceniodawcy wykonania niniejszej Umowy poprzez zablokowanie Zleceniobiorcy fizycznego dostępu do miejsca wykonania Usług,</li>
      <li>dopuszczania się odstępstw od warunków niniejszej Umowy przez Zleceniodawcę, bez ich uzgodnienia z Zleceniobiorcą,</li>
      <li>braku terminowej zapłaty wynagrodzenia przez Zleceniodawcę za wykonane Usługi, zgodnie z warunkami płatności określonymi w § 4 niniejszej Umowie.</li>
    </ol>
  </li>
  <li>Żadna ze Stron nie będzie odpowiedzialna względem drugiej Strony w przypadku, gdy do niewykonania umowy dojdzie na skutek okoliczności siły wyższej, zdarzeń losowych lub innych okoliczności niezależnych od woli którejkolwiek ze Stron.</li>
</ol>

<p class="section-title">§ 6<br>Klauzula poufności</p>
<ol>
  <li>Zleceniobiorca przetwarza dane osobowe Zleceniodawcy wyłącznie w zakresie niezbędnym do realizacji Umowy oraz zgodnie z obowiązującymi przepisami prawa, w tym RODO. Zleceniobiorca zapewnia stosowanie odpowiednich środków technicznych i organizacyjnych chroniących dane osobowe przed nieuprawnionym dostępem.</li>
  <li>Materiały, dokumenty lub informacje dotyczące danej Strony, zarówno handlowe, finansowe, technologiczne lub inne, ujawnione drugiej Stronie w związku z wykonaniem Umowy, oznaczone jako poufne lub w inny sposób zastrzeżone, podlegają postanowieniom określonym w niniejszym paragrafie.</li>
  <li>Każda ze Stron zobowiązuje się do nieprzekazywania i nieudostępniania osobom trzecim Informacji Poufnych uzyskanych od drugiej Strony.</li>
  <li>Jakiekolwiek dokumenty inne niż Umowa, o których mowa w ust. 1, pozostają własnością danej Strony i podlegają zwrotowi na żądanie danej Strony wraz ze wszystkimi kopiami po zakończeniu realizacji Umowy.</li>
  <li>Strony zobowiązują się poinformować swoich pracowników oraz współpracowników o obowiązkach wynikających z niniejszej klauzuli poufności.</li>
  <li>Udostępnienie Informacji Poufnych przez Strony osobom trzecim możliwe jest jedynie za uprzednią pisemną zgodą drugiej Strony albo na żądanie sądu, prokuratury, policji i innych organów państwowych uprawnionych do ich uzyskania na podstawie ustawy.</li>
  <li>W przypadku naruszenia zakazu, o którym mowa w niniejszym paragrafie, Zleceniodawca zobowiązany będzie do zapłaty kary umownej w wysokości 5.000 PLN (słownie: pięciu tysięcy złotych) za każde naruszenie.</li>
</ol>

<p class="section-title">§ 7<br>Siła Wyższa</p>
<ol>
  <li>Żadna ze Stron nie ponosi odpowiedzialności za opóźnienie lub niewykonanie Umowy w takim zakresie, w jakim zostało to spowodowane działaniem siły wyższej.</li>
  <li>Przez siłę wyższą rozumie się zdarzenia zewnętrzne, niezależne od Stron i niemożliwe do przewidzenia, takie jak w szczególności: wojna, pożar, epidemia, powódź, blokady komunikacyjne o charakterze ponadregionalnym, kataklizmy społeczne albo katastrofy budowli lub budynków.</li>
  <li>W przypadku wystąpienia siły wyższej Strona, która uzyskała taką informację poinformuje niezwłocznie drugą Stronę o niemożności wykonania swoich zobowiązań wynikających z Umowy.</li>
</ol>

<p class="section-title">§ 8<br>Reklamacje</p>
<ol>
  <li>Wszelkie reklamacje dotyczące sposobu wykonywania Umowy powinny być składane na piśmie na adres e-mail <strong>biuro@twojadecyzja.online</strong> w terminie 14 dni od dnia zaistnienia zdarzenia stanowiącego podstawę reklamacji. Zleceniobiorca zobowiązuje się rozpatrzyć reklamację w terminie 30 dni od jej otrzymania.</li>
</ol>

<p class="section-title">§ 9<br>Postanowienia końcowe</p>
<ol start="2">
  <li>Umowa zastępuje wszelkie wcześniejsze czy istniejące ustalenia lub umowy, ustne czy pisemne, niezależnie od daty ich podjęcia czy zawarcia.</li>
  <li>Każda ze Stron jest zobowiązana do niezwłocznego informowania drugiej Strony o wszelkich okolicznościach, które mogą mieć znaczenie dla wykonania Umowy. Osobami odpowiedzialnymi za wykonanie Umowy są ze strony:<br><br>
    Zleceniobiorca: <strong>TWOJA DECYZJA SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ</strong>, ul. Stanisława Taczaka 24/301, 61-819 Poznań, e-mail: biuro@twojadecyzja.online, telefon: +48 459 567 976<br><br>
    Zleceniodawca: ${v(clientName)}, ${v(clientAddress)}, ${v(clientPhone)}${clientEmail !== '___' ? `, ${v(clientEmail)}` : ''}
  </li>
  <li>Postanowienia Umowy, które okazałyby się nieważne lub nieskuteczne, zostają automatycznie zastąpione postanowieniami ważnymi i skutecznymi, realizującymi możliwie najpełniej cel postanowień pierwotnych.</li>
  <li>Strony uzgadniają, że będą dążyły do polubownego rozstrzygnięcia ewentualnych sporów wynikłych na tle realizacji Umowy, a w przypadku braku możliwości zawarcia ugody wszelkie spory będą rozstrzygane przez sąd powszechny właściwy dla Zleceniobiorcy.</li>
  <li>W zakresie nieuregulowanym niniejszą Umową zastosowanie znajdują obowiązujące przepisy polskiego prawa, w szczególności ustawy z dnia 23 kwietnia 1964 r. – Kodeks cywilny.</li>
</ol>
<p>Umowę sporządzono w dwóch jednobrzmiących egzemplarzach po jednym dla każdej ze Stron.</p>
<ol start="7">
  <li>Wszelkie zmiany treści Umowy wymagają formy pisemnej pod rygorem nieważności, chyba że w jej treści postanowiono inaczej.</li>
  <li>Załączniki stanowią integralną część Umowy.</li>
  <li>W zakresie danych osobowych przetwarzanych na podstawie niniejszej Umowy zastosowanie znajdą przepisy dotyczące ochrony danych osobowych, w szczególności Rozporządzenie Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27.04.2016 roku (RODO) oraz ustawa z dnia 10.05.2018 roku o ochronie danych osobowych.</li>
</ol>

<div class="signatures">
  <div class="sig">
    <div class="sig-line">podpis Administratora<br><strong>TWOJA DECYZJA sp. z o.o.</strong></div>
  </div>
  <div class="sig">
    <div class="sig-line">podpis Zleceniodawcy<br><strong>${clientName}</strong></div>
  </div>
</div>

<div class="clause-info">
  <h2>Klauzula informacyjna</h2>
  <p>Na podstawie art. 13 ust. 1 i 2 Rozporządzenia Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r. (RODO), w związku z realizacją Umowy zlecenia nr ${v(contractNo)} z dnia ${v(dateStr)} o przygotowanie wniosku o wydanie zezwolenia na pobyt czasowy i reprezentowanie Pani/Pana w postępowaniu administracyjnym wywołanym złożeniem tego wniosku przed właściwym miejscowo Urzędem Wojewódzkim, informuję, że:</p>
  <p>Administratorem danych osobowych jest Serhii Kompanii, prowadzący działalność gospodarczą pod firmą <strong>TWOJA DECYZJA SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ</strong>, z siedzibą w Poznaniu, 61-819 ul. Stanisława Taczaka 24/301, KRS 0001199573, NIP 7831938936.</p>
  <p>W sprawach dotyczących bezpieczeństwa danych osobowych można skontaktować się pod adresem e-mail: <strong>biuro@twojadecyzja.online</strong></p>

  <ol>
    <li>Administrator będzie przetwarzał Pani/Pana dane osobowe w celu wykonania Umowy zlecenia nr ${v(contractNo)} z dnia ${v(dateStr)}, na podstawie art. 6 ust. 1 lit. b RODO, a także w celach archiwalnych i w celu ewentualnego ustalenia, dochodzenia lub obrony przed roszczeniami, na podstawie art. 6 ust. 1 lit. f RODO.</li>
    <li>Zbieraniu i dalszemu przetwarzaniu podlegają wyłącznie dane osobowe niezbędne do uzyskania zezwolenia na pobyt w Rzeczypospolitej Polskiej, wymagane zgodnie z aktualnymi przepisami regulującymi postępowanie o wydanie takiego zezwolenia.</li>
    <li>Pani/Pana dane osobowe będą udostępniane upoważnionym pracownikom Administratora danych oraz właściwym miejscowo organom administracji, upoważnionym do prowadzenia postępowań i wydawania obcokrajowcom zezwoleń na pobyt w Rzeczypospolitej Polskiej.</li>
    <li>Administrator nie przekazuje Państwa danych osobowych do państwa trzeciego lub organizacji międzynarodowej lub poza teren Europejskiego Obszaru Gospodarczego.</li>
    <li>Pani/Pana dane osobowe będą przechowywane do momentu ostatecznego zakończenia postępowania o wydanie zezwolenia na pobyt lub prawomocnego zakończenia postępowania sądowoadministracyjnego.</li>
    <li>Przysługuje Pani/Panu prawo dostępu do treści swoich danych, ich poprawiania, sprostowania lub uzupełnienia oraz prawo do żądania usunięcia lub ograniczenia przetwarzania. Jeżeli uważają Państwo, że dane przetwarzane są niezgodnie z prawem, mają Państwo prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych.</li>
    <li>Podanie danych osobowych jest dobrowolne, ale niezbędne do prawidłowego wykonania Umowy.</li>
  </ol>
</div>

<div class="consent-block">
  <p style="text-align:center">
    ………………………………………………….&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;………………………………………………….
    <br>
    <span style="font-size:10pt">podpis Administratora&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;podpis Zleceniodawcy</span>
  </p>
  <hr style="margin:16px 0">
  <p><strong>Oświadczam, że:</strong></p>
  <ul>
    <li>Wyrażam zgodę na przetwarzanie moich danych osobowych do celów realizacji Umowy zlecenia nr ${v(contractNo)} z dnia ${v(dateStr)} o przygotowanie wniosku o wydanie zezwolenia na pobyt czasowy i reprezentowanie mnie w postępowaniu administracyjnym wywołanym złożeniem tego wniosku przed właściwym miejscowo Urzędem Wojewódzkim;</li>
    <li>Przekazanie moich danych osobowych Administratorowi ma charakter dobrowolny;</li>
    <li>zapoznałam/-em się z Klauzulą informacyjną.</li>
  </ul>

  <div class="final-sig">
    <p>Poznań, ${v(dateStr)}</p>
    <p style="font-size:10pt;color:#555;margin-top:4px">miejscowość, data</p>
    <p style="margin-top:40px">…………………………………………………..</p>
    <p style="font-size:10pt">imię i nazwisko, podpis Zleceniodawcy</p>
    <p style="font-weight:bold;margin-top:4px">${clientName}</p>
  </div>
</div>
</div></div>`
}

function ContractInner() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'notFound' }
    | { status: 'missing'; html: string }
    | { status: 'ready'; html: string; title: string; dealUuid: string; displayNo: string; filenameBase: string }
  >({ status: 'loading' })

  useEffect(() => {
    if (!id) {
      setState({ status: 'notFound' })
      return
    }
    ;(async () => {
      const supabase = createClient()
      const { data: deal } = await supabase
        .from('deals')
        .select('*')
        .eq(lookupColumn(id), lookupValue(id))
        .single()
      if (!deal) {
        setState({ status: 'notFound' })
        return
      }
      const dealUuid = deal.id as string
      let contact: Contact | null = null
      if (deal.contact_id) {
        const { data } = await supabase
          .from('contacts')
          .select('*')
          .eq('id', deal.contact_id)
          .single()
        contact = data as Contact | null
      }
      const { missing, isReady } = checkContractReadiness(deal as Deal, contact)
      const displayNo = (deal as Deal).number ?? dealUuid
      if (!isReady) {
        setState({
          status: 'missing',
          html: renderMissingFieldsHtml(String(displayNo), missing),
        })
        return
      }
      const html = buildContractHtml(deal as Deal, contact)
      const clientName = contact
        ? [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim()
        : ''
      const safeClient = clientName.replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s+/g, '_')
      const filenameBase = `Umowa_${displayNo}${safeClient ? '_' + safeClient : ''}`
      setState({
        status: 'ready',
        html,
        title: `Umowa ${displayNo}`,
        dealUuid,
        displayNo: String(displayNo),
        filenameBase,
      })
    })()
  }, [id])

  useEffect(() => {
    if (state.status === 'ready') {
      document.title = state.title
    }
  }, [state])

  if (state.status === 'loading') {
    return (
      <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif' }}>
        Загрузка договора…
      </div>
    )
  }
  if (state.status === 'notFound') {
    return (
      <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif' }}>
        Сделка не найдена.
      </div>
    )
  }
  if (state.status === 'missing') {
    return <div dangerouslySetInnerHTML={{ __html: state.html }} />
  }
  return <ContractView state={state} />
}

type ReadyState = {
  status: 'ready'
  html: string
  title: string
  dealUuid: string
  displayNo: string
  filenameBase: string
}

function ContractView({ state }: { state: ReadyState }) {
  const docRef = useRef<HTMLDivElement>(null)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Close dropdown on outside click
  useEffect(() => {
    if (!downloadOpen) return
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-download-menu]')) setDownloadOpen(false)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [downloadOpen])

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  function downloadHtml() {
    const full = `<!doctype html><html><head><meta charset="utf-8"><title>${state.title}</title></head><body>${state.html}</body></html>`
    triggerDownload(new Blob([full], { type: 'text/html;charset=utf-8' }), `${state.filenameBase}.html`)
    setDownloadOpen(false)
  }

  function downloadDocx() {
    // Word opens HTML files with .doc extension. The Office-specific prelude
    // improves rendering fidelity for paragraphs/tables.
    const prelude = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset="utf-8"><title>${state.title}</title></head><body>`
    const full = prelude + state.html + '</body></html>'
    triggerDownload(
      new Blob(['\ufeff', full], { type: 'application/msword' }),
      `${state.filenameBase}.doc`,
    )
    setDownloadOpen(false)
  }

  function downloadTxt() {
    const node = docRef.current
    if (!node) return
    const text = node.innerText.replace(/\n{3,}/g, '\n\n').trim()
    triggerDownload(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${state.filenameBase}.txt`)
    setDownloadOpen(false)
  }

  async function downloadPdf() {
    setDownloadOpen(false)
    const node = docRef.current
    if (!node) return
    const html2pdfModule = await import('html2pdf.js')
    const html2pdf = (html2pdfModule as { default: () => { set: (o: unknown) => { from: (el: HTMLElement) => { save: () => Promise<void> } } } }).default
    await html2pdf()
      .set({
        margin: [12, 12, 12, 12],
        filename: `${state.filenameBase}.pdf`,
        image: { type: 'jpeg', quality: 0.96 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      })
      .from(node)
      .save()
  }

  async function saveToDeal() {
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: cur } = await supabase
        .from('deals')
        .select('metadata')
        .eq('id', state.dealUuid)
        .single()
      const mergedMeta = {
        ...((cur?.metadata as Record<string, unknown>) || {}),
        contract_html: state.html,
        contract_generated_at: new Date().toISOString(),
        contract_number: state.displayNo,
      }
      await supabase.from('deals').update({ metadata: mergedMeta }).eq('id', state.dealUuid)
      await supabase.from('activities').insert({
        type: 'note',
        description: `Договор № ${state.displayNo} сохранён в карточке сделки`,
        deal_id: state.dealUuid,
        user_id: '00000000-0000-0000-0000-000000000000',
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div
        className="contract-toolbar"
        style={{
          position: 'fixed',
          top: 12,
          right: 12,
          display: 'flex',
          gap: 8,
          zIndex: 100,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Download dropdown */}
        <div data-download-menu style={{ position: 'relative' }}>
          <button
            onClick={() => setDownloadOpen((o) => !o)}
            style={toolbarBtnStyle('#1a3a6b')}
          >
            <Download size={14} /> Скачать <ChevronDown size={12} />
          </button>
          {downloadOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                minWidth: 180,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                boxShadow: '0 6px 24px rgba(0,0,0,.12)',
                overflow: 'hidden',
              }}
            >
              {[
                { label: 'PDF', onClick: downloadPdf },
                { label: 'Word (.doc)', onClick: downloadDocx },
                { label: 'HTML', onClick: downloadHtml },
                { label: 'Текст (.txt)', onClick: downloadTxt },
              ].map((opt) => (
                <button
                  key={opt.label}
                  onClick={opt.onClick}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 14px',
                    fontSize: 13,
                    color: '#111',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={saveToDeal}
          disabled={saving}
          style={toolbarBtnStyle(saved ? '#16a34a' : '#0f766e')}
        >
          {saved ? <Check size={14} /> : <Save size={14} />}
          {saved ? 'Сохранено' : saving ? 'Сохранение…' : 'В карточку'}
        </button>

        <button
          onClick={() => window.print()}
          style={toolbarBtnStyle('#1a3a6b')}
        >
          <Printer size={14} /> Печать
        </button>
      </div>

      <div ref={docRef} dangerouslySetInnerHTML={{ __html: state.html }} />
    </>
  )
}

function toolbarBtnStyle(bg: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: bg,
    color: '#fff',
    border: 'none',
    padding: '9px 16px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,.25)',
  }
}

export default function ContractPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif' }}>
          Загрузка…
        </div>
      }
    >
      <ContractInner />
    </Suspense>
  )
}
