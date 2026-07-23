import type { ClinicConfig } from '../clinic.js';

/**
 * Sunshine Dental — the first clinic, and the default when `CLINIC_ID` /
 * `VITE_CLINIC_ID` is unset.
 *
 * Every value here was lifted **verbatim** from where it used to be hardcoded
 * (the chat receptionist prompt, the web locales, the Vite PWA manifest, the
 * seed, and the n8n router's "FAQ Handler" node), so extracting this config
 * changed no behaviour. Keep it that way: edit Sunshine's facts here, not in
 * the consuming code.
 */
export const sunshine: ClinicConfig = {
  id: 'sunshine',
  name: 'Sunshine Dental',
  fullName: 'Sunshine Dental Clinic',
  shortName: 'SD Chat',
  personaName: 'Sarah',

  timezone: 'Europe/Budapest',
  languages: ['en', 'hu', 'de'],
  defaultLanguage: 'en',

  contact: {
    addressLine: 'Dózsa György út 132',
    postcode: '1134',
    city: 'Budapest',
    country: 'Hungary',
    phone: '+36 20 2576701',
    email: 'elystrade@gmail.com',
    website: 'https://sunshine.dental.appointer.hu',
  },

  emergencyNumber: '112',

  brand: {
    themeColor: '#55624d',
    backgroundColor: '#f8faf3',
  },

  officeHoursSummary:
    'Mon–Fri 8:00–17:00, Sat 9:00–13:00, closed Sunday. No appointments 12:00–13:00 on weekdays (lunch).',

  faq: {
    en: {
      office_hours:
        'Our office hours are Monday to Friday, 8:00 AM to 5:00 PM, and Saturday 9:00 AM to 1:00 PM. We are closed on Sundays. We also have a lunch break from 12:00 PM to 1:00 PM on weekdays.',
      services:
        'We offer general dentistry (cleanings, exams, fillings, crowns), cosmetic dentistry (teeth whitening, veneers, bonding), orthodontics (braces and Invisalign), oral surgery (extractions and wisdom teeth removal), pediatric dentistry for children, and emergency dental care with same-day appointments.',
      insurance:
        'We work with Generali and Medicover, and we also welcome self-paying patients without insurance.',
      emergency:
        'For dental emergencies during our office hours, please call us at +36 20 2576701. For a life-threatening emergency, such as severe bleeding or swelling that affects breathing, call 112 or go to the nearest emergency room immediately. If a tooth has been knocked out, keep it moist in milk or saliva and come in right away.',
      cancellation_policy:
        'Please cancel or reschedule at least 24 hours in advance. Cancellations made less than 24 hours before the appointment may incur a fee of 10,000 HUF.',
      new_patient_info:
        'If you are a new patient, please arrive 15 minutes early and bring your insurance card and a list of any medications you currently take.',
      location:
        'We are located at Dózsa György út 132, 1134 Budapest. You can reach us by phone at +36 20 2576701 or by email at elystrade@gmail.com. You can also find us online at https://sunshine.dental.appointer.hu.',
      payment_options: 'You can pay in cash in Hungarian forint, or by VISA or Mastercard.',
    },
    hu: {
      office_hours:
        'Rendelőnk nyitvatartása hétfőtől péntekig 8:00 és 17:00 óra között, szombaton 9:00 és 13:00 óra között. Vasárnap zárva tartunk. Hétköznaponként 12:00 és 13:00 óra között ebédszünetet tartunk.',
      services:
        'Szolgáltatásaink: általános fogászat (fogkőeltávolítás, vizsgálatok, tömések, koronák), esztétikai fogászat (fogfehérítés, héjak, bondozás), fogszabályozás (rögzített fogszabályozó és Invisalign), szájsebészet (foghúzás és bölcsességfog-eltávolítás), gyermekfogászat, valamint sürgősségi fogászati ellátás aznapi időpontokkal.',
      insurance:
        'A Generali és a Medicover biztosítókkal állunk kapcsolatban, és biztosítás nélküli, önfizető pácienseket is szívesen fogadunk.',
      emergency:
        'Fogászati sürgősség esetén nyitvatartási időben hívjon minket a +36 20 2576701 telefonszámon. Életveszélyes helyzetben, például erős vérzés vagy a légzést akadályozó duzzanat esetén, hívja a 112-t, vagy menjen azonnal a legközelebbi sürgősségi ügyeletre. Ha egy fog kiesett, tartsa nedvesen tejben vagy nyálban, és jöjjön be mihamarabb.',
      cancellation_policy:
        'Kérjük, legalább 24 órával korábban mondja le vagy módosítsa az időpontját. A 24 órán belüli lemondás esetén 10 000 forint díjat számíthatunk fel.',
      new_patient_info:
        'Új páciensként kérjük, érkezzen 15 perccel korábban, és hozza magával a személyi igazolványát, a TAJ-kártyáját, valamint a jelenleg szedett gyógyszerei listáját.',
      location:
        'Címünk: 1134 Budapest, Dózsa György út 132. Telefonon a +36 20 2576701 számon, e-mailben az elystrade@gmail.com címen érhet el minket. Online is megtalál minket a https://sunshine.dental.appointer.hu oldalon.',
      payment_options:
        'Fizethet készpénzzel forintban, vagy VISA, illetve Mastercard bankkártyával.',
    },
    de: {
      office_hours:
        'Unsere Öffnungszeiten sind Montag bis Freitag von 8:00 bis 17:00 Uhr und Samstag von 9:00 bis 13:00 Uhr. Sonntags haben wir geschlossen. An Wochentagen machen wir von 12:00 bis 13:00 Uhr Mittagspause.',
      services:
        'Wir bieten allgemeine Zahnheilkunde (Zahnreinigung, Untersuchungen, Füllungen, Kronen), ästhetische Zahnheilkunde (Bleaching, Veneers, Bonding), Kieferorthopädie (feste Zahnspangen und Invisalign), Oralchirurgie (Extraktionen und Weisheitszahnentfernung), Kinderzahnheilkunde sowie zahnärztliche Notfallversorgung mit Terminen am selben Tag.',
      insurance:
        'Wir arbeiten mit Generali und Medicover zusammen und nehmen auch Selbstzahler ohne Versicherung gerne auf.',
      emergency:
        'Bei einem zahnärztlichen Notfall rufen Sie uns während der Öffnungszeiten unter +36 20 2576701 an. Bei einem lebensbedrohlichen Notfall, etwa starken Blutungen oder Schwellungen, die die Atmung beeinträchtigen, wählen Sie 112 oder begeben Sie sich sofort in die nächste Notaufnahme. Wenn ein Zahn ausgeschlagen wurde, halten Sie ihn in Milch oder Speichel feucht und kommen Sie umgehend zu uns.',
      cancellation_policy:
        'Bitte sagen Sie Ihren Termin mindestens 24 Stunden im Voraus ab oder verschieben Sie ihn. Bei Absagen weniger als 24 Stunden vor dem Termin kann eine Gebühr von 10.000 HUF anfallen.',
      new_patient_info:
        'Als neue Patientin oder neuer Patient kommen Sie bitte 15 Minuten früher und bringen Sie Ihre Versicherungskarte sowie eine Liste Ihrer aktuellen Medikamente mit.',
      location:
        'Sie finden uns in der Dózsa György út 132, 1134 Budapest. Sie erreichen uns telefonisch unter +36 20 2576701 oder per E-Mail an elystrade@gmail.com. Online finden Sie uns unter https://sunshine.dental.appointer.hu.',
      payment_options:
        'Sie können bar in ungarischen Forint oder mit VISA bzw. Mastercard bezahlen.',
    },
  },

  seed: {
    // Matches the accounts the demo seed has always created, so `--minimal`
    // produces the same logins on a fresh Sunshine stack.
    staff: [
      { title: 'Dr.', givenName: 'Admin', familyName: '', email: 'admin@sunshine.dental', role: 'ADMIN' },
      {
        title: 'Dr.',
        givenName: 'Ibolya',
        familyName: 'Nagy',
        email: 'alice@sunshine.dental',
        role: 'PROVIDER',
        specialty: 'General Dentistry',
        phone: '+1-555-0101',
        bio: 'Experienced general dentist with 10+ years in family dental care.',
      },
      {
        title: 'Dr.',
        givenName: 'István',
        familyName: 'Kis',
        email: 'bob@sunshine.dental',
        role: 'PROVIDER',
        specialty: 'Orthodontics',
        phone: '+1-555-0102',
        bio: 'Specialist in orthodontics and cosmetic dentistry.',
      },
      { givenName: 'Sara', familyName: 'Johnson', email: 'sara@sunshine.dental', role: 'ASSISTANT' },
    ],
    availability: {
      weekdays: [1, 2, 3, 4, 5],
      horizonDays: 10,
      blocks: [
        { title: 'Morning Availability', start: '09:00', end: '13:00', type: 'AVAILABLE' },
        { title: 'Lunch Break', start: '13:00', end: '14:00', type: 'BLOCKED', notes: 'Lunch' },
        { title: 'Afternoon Availability', start: '14:00', end: '17:00', type: 'AVAILABLE' },
      ],
    },
  },
};
