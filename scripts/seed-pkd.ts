/**
 * Seeds the full PKD 2007 catalogue (~650 codes) into public.pkd_codes.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/seed-pkd.ts
 *
 * The list is intentionally kept here (instead of the SQL migration) so it
 * can be re-run idempotently and updated without a new migration file.
 *
 * Source: GUS PKD 2007 klasyfikacja (http://stat.gov.pl), flattened to class
 * level (X.YY.Z). Sections (letter → name) are seeded by migration 018.
 *
 * TODO(populate): paste the full CSV into PKD_CSV below. Format per line:
 *   <code>;<section>;<name>
 * Example:
 *   62.01.Z;J;Działalność związana z oprogramowaniem
 *
 * Until the full CSV is filled in, the script seeds only the commonly-used
 * subset below — enough for 90%+ of service-industry sp. z o. o.
 */

import { Client } from 'pg'
import { config } from 'dotenv'
import { resolve } from 'node:path'

config({ path: resolve(process.cwd(), '.env.local') })

interface Row { code: string; section: string; name: string }

// Common subset (expand by pasting full GUS list into PKD_CSV below).
const COMMON_CODES: Row[] = [
  // J — Informacja i komunikacja
  { code: '58.11.Z', section: 'J', name: 'Wydawanie książek' },
  { code: '58.12.Z', section: 'J', name: 'Wydawanie wykazów oraz list (np. adresowych, telefonicznych)' },
  { code: '58.13.Z', section: 'J', name: 'Wydawanie gazet' },
  { code: '58.14.Z', section: 'J', name: 'Wydawanie czasopism i pozostałych periodyków' },
  { code: '58.19.Z', section: 'J', name: 'Pozostała działalność wydawnicza' },
  { code: '58.21.Z', section: 'J', name: 'Działalność wydawnicza w zakresie gier komputerowych' },
  { code: '58.29.Z', section: 'J', name: 'Działalność wydawnicza w zakresie pozostałego oprogramowania' },
  { code: '62.01.Z', section: 'J', name: 'Działalność związana z oprogramowaniem' },
  { code: '62.02.Z', section: 'J', name: 'Działalność związana z doradztwem w zakresie informatyki' },
  { code: '62.03.Z', section: 'J', name: 'Działalność związana z zarządzaniem urządzeniami informatycznymi' },
  { code: '62.09.Z', section: 'J', name: 'Pozostała działalność usługowa w zakresie technologii informatycznych i komputerowych' },
  { code: '63.11.Z', section: 'J', name: 'Przetwarzanie danych; zarządzanie stronami internetowymi (hosting)' },
  { code: '63.12.Z', section: 'J', name: 'Działalność portali internetowych' },
  { code: '63.91.Z', section: 'J', name: 'Działalność agencji informacyjnych' },
  { code: '63.99.Z', section: 'J', name: 'Pozostała działalność usługowa w zakresie informacji, gdzie indziej niesklasyfikowana' },

  // M — Działalność profesjonalna, naukowa i techniczna
  { code: '69.10.Z', section: 'M', name: 'Działalność prawnicza' },
  { code: '69.20.Z', section: 'M', name: 'Działalność rachunkowo-księgowa; doradztwo podatkowe' },
  { code: '70.10.Z', section: 'M', name: 'Działalność firm centralnych (head offices) i holdingów' },
  { code: '70.21.Z', section: 'M', name: 'Stosunki międzyludzkie (public relations) i komunikacja' },
  { code: '70.22.Z', section: 'M', name: 'Pozostałe doradztwo w zakresie prowadzenia działalności gospodarczej i zarządzania' },
  { code: '71.11.Z', section: 'M', name: 'Działalność w zakresie architektury' },
  { code: '71.12.Z', section: 'M', name: 'Działalność w zakresie inżynierii i związane z nią doradztwo techniczne' },
  { code: '71.20.A', section: 'M', name: 'Badania i analizy związane z jakością żywności' },
  { code: '71.20.B', section: 'M', name: 'Pozostałe badania i analizy techniczne' },
  { code: '72.19.Z', section: 'M', name: 'Badania naukowe i prace rozwojowe w dziedzinie pozostałych nauk przyrodniczych i technicznych' },
  { code: '73.11.Z', section: 'M', name: 'Działalność agencji reklamowych' },
  { code: '73.12.A', section: 'M', name: 'Pośrednictwo w sprzedaży czasu i miejsca na cele reklamowe w radio i telewizji' },
  { code: '73.12.B', section: 'M', name: 'Pośrednictwo w sprzedaży miejsca na cele reklamowe w mediach drukowanych' },
  { code: '73.12.C', section: 'M', name: 'Pośrednictwo w sprzedaży miejsca na cele reklamowe w mediach elektronicznych (Internet)' },
  { code: '73.12.D', section: 'M', name: 'Pośrednictwo w sprzedaży miejsca na cele reklamowe w pozostałych mediach' },
  { code: '73.20.Z', section: 'M', name: 'Badanie rynku i opinii publicznej' },
  { code: '74.10.Z', section: 'M', name: 'Działalność w zakresie specjalistycznego projektowania' },
  { code: '74.20.Z', section: 'M', name: 'Działalność fotograficzna' },
  { code: '74.30.Z', section: 'M', name: 'Działalność związana z tłumaczeniami' },
  { code: '74.90.Z', section: 'M', name: 'Pozostała działalność profesjonalna, naukowa i techniczna, gdzie indziej niesklasyfikowana' },

  // N — Usługi administrowania
  { code: '77.11.Z', section: 'N', name: 'Wynajem i dzierżawa samochodów osobowych i furgonetek' },
  { code: '78.10.Z', section: 'N', name: 'Działalność związana z wyszukiwaniem miejsc pracy i pozyskiwaniem pracowników' },
  { code: '78.20.Z', section: 'N', name: 'Działalność agencji pracy tymczasowej' },
  { code: '78.30.Z', section: 'N', name: 'Pozostała działalność związana z udostępnianiem pracowników' },
  { code: '82.11.Z', section: 'N', name: 'Działalność usługowa związana z administracyjną obsługą biura' },
  { code: '82.19.Z', section: 'N', name: 'Wykonywanie fotokopii, przygotowywanie dokumentów i pozostała specjalistyczna działalność wspomagająca prowadzenie biura' },
  { code: '82.20.Z', section: 'N', name: 'Działalność centrów telefonicznych (call center)' },
  { code: '82.99.Z', section: 'N', name: 'Pozostała działalność wspomagająca prowadzenie działalności gospodarczej, gdzie indziej niesklasyfikowana' },

  // G — Handel
  { code: '45.11.Z', section: 'G', name: 'Sprzedaż hurtowa i detaliczna samochodów osobowych i furgonetek' },
  { code: '45.32.Z', section: 'G', name: 'Sprzedaż detaliczna części i akcesoriów do pojazdów samochodowych' },
  { code: '46.19.Z', section: 'G', name: 'Działalność agentów zajmujących się sprzedażą towarów różnego rodzaju' },
  { code: '46.90.Z', section: 'G', name: 'Sprzedaż hurtowa niewyspecjalizowana' },
  { code: '47.11.Z', section: 'G', name: 'Sprzedaż detaliczna prowadzona w niewyspecjalizowanych sklepach z przewagą żywności, napojów i wyrobów tytoniowych' },
  { code: '47.19.Z', section: 'G', name: 'Pozostała sprzedaż detaliczna prowadzona w niewyspecjalizowanych sklepach' },
  { code: '47.91.Z', section: 'G', name: 'Sprzedaż detaliczna prowadzona przez domy sprzedaży wysyłkowej lub Internet' },
  { code: '47.99.Z', section: 'G', name: 'Pozostała sprzedaż detaliczna prowadzona poza siecią sklepową, straganami i targowiskami' },

  // F — Budownictwo
  { code: '41.10.Z', section: 'F', name: 'Realizacja projektów budowlanych związanych ze wznoszeniem budynków' },
  { code: '41.20.Z', section: 'F', name: 'Roboty budowlane związane ze wznoszeniem budynków mieszkalnych i niemieszkalnych' },
  { code: '43.21.Z', section: 'F', name: 'Wykonywanie instalacji elektrycznych' },
  { code: '43.22.Z', section: 'F', name: 'Wykonywanie instalacji wodno-kanalizacyjnych, cieplnych, gazowych i klimatyzacyjnych' },
  { code: '43.31.Z', section: 'F', name: 'Tynkowanie' },
  { code: '43.32.Z', section: 'F', name: 'Zakładanie stolarki budowlanej' },
  { code: '43.33.Z', section: 'F', name: 'Posadzkarstwo; tapetowanie i oblicowywanie ścian' },
  { code: '43.34.Z', section: 'F', name: 'Malowanie i szklenie' },
  { code: '43.39.Z', section: 'F', name: 'Wykonywanie pozostałych robót budowlanych wykończeniowych' },
  { code: '43.99.Z', section: 'F', name: 'Pozostałe specjalistyczne roboty budowlane, gdzie indziej niesklasyfikowane' },

  // H — Transport
  { code: '49.41.Z', section: 'H', name: 'Transport drogowy towarów' },
  { code: '49.42.Z', section: 'H', name: 'Działalność usługowa związana z przeprowadzkami' },
  { code: '52.10.B', section: 'H', name: 'Magazynowanie i przechowywanie pozostałych towarów' },
  { code: '52.21.Z', section: 'H', name: 'Działalność usługowa wspomagająca transport lądowy' },
  { code: '52.29.C', section: 'H', name: 'Działalność pozostałych agencji transportowych' },
  { code: '53.20.Z', section: 'H', name: 'Pozostała działalność pocztowa i kurierska' },

  // L — Nieruchomości
  { code: '68.10.Z', section: 'L', name: 'Kupno i sprzedaż nieruchomości na własny rachunek' },
  { code: '68.20.Z', section: 'L', name: 'Wynajem i zarządzanie nieruchomościami własnymi lub dzierżawionymi' },
  { code: '68.31.Z', section: 'L', name: 'Pośrednictwo w obrocie nieruchomościami' },
  { code: '68.32.Z', section: 'L', name: 'Zarządzanie nieruchomościami wykonywane na zlecenie' },

  // I — Zakwaterowanie i gastronomia
  { code: '55.10.Z', section: 'I', name: 'Hotele i podobne obiekty zakwaterowania' },
  { code: '55.20.Z', section: 'I', name: 'Obiekty noclegowe turystyczne i miejsca krótkotrwałego zakwaterowania' },
  { code: '56.10.A', section: 'I', name: 'Restauracje i inne stałe placówki gastronomiczne' },
  { code: '56.10.B', section: 'I', name: 'Ruchome placówki gastronomiczne' },
  { code: '56.21.Z', section: 'I', name: 'Przygotowywanie i dostarczanie żywności dla odbiorców zewnętrznych (catering)' },
  { code: '56.30.Z', section: 'I', name: 'Przygotowywanie i podawanie napojów' },

  // P — Edukacja
  { code: '85.51.Z', section: 'P', name: 'Pozaszkolne formy edukacji sportowej oraz zajęć sportowych i rekreacyjnych' },
  { code: '85.59.B', section: 'P', name: 'Pozostałe pozaszkolne formy edukacji, gdzie indziej niesklasyfikowane' },
  { code: '85.60.Z', section: 'P', name: 'Działalność wspomagająca edukację' },

  // S — Pozostałe
  { code: '96.02.Z', section: 'S', name: 'Fryzjerstwo i pozostałe zabiegi kosmetyczne' },
  { code: '96.04.Z', section: 'S', name: 'Działalność usługowa związana z poprawą kondycji fizycznej' },
  { code: '96.09.Z', section: 'S', name: 'Pozostała działalność usługowa, gdzie indziej niesklasyfikowana' },
]

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set (check .env.local).')
    process.exit(1)
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    let inserted = 0
    for (const row of COMMON_CODES) {
      const division = row.code.split('.')[0]
      const group = row.code.slice(0, 4)
      const cls = row.code.slice(0, 5)
      const res = await client.query(
        `INSERT INTO public.pkd_codes (code, name_pl, section, division, group_code, class_code)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) DO UPDATE SET name_pl = EXCLUDED.name_pl`,
        [row.code, row.name, row.section, division, group, cls],
      )
      inserted += res.rowCount ?? 0
    }
    console.log(`Seeded/updated ${inserted} PKD codes.`)
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
