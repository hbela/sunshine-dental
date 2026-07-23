import type { ClinicConfig } from '../clinic.js';

/**
 * Corona Dental — clinic #2 (Szentendre).
 *
 * Modelled on a real private practice to exercise a realistic setup, but every
 * **proprietary or personal** detail has been changed to avoid exposing the real
 * clinic: doctor names, phone numbers, e-mail, website and the exact street
 * address are all fictional. The non-identifying operational facts (opening
 * hours, service range, payment methods, the 24-hour cancellation fee, the
 * new-patient "Start package") mirror how such a clinic actually presents
 * itself, so the agent behaves believably.
 *
 * Before a real go-live these fictional values must be replaced with the
 * customer's own, from their returned `docs/clinic-intake-form.md`.
 */
export const corona: ClinicConfig = {
  id: 'corona',
  name: 'Corona Dental',
  fullName: 'Corona Dental Szentendre',
  shortName: 'Corona',
  personaName: 'Petra',

  timezone: 'Europe/Budapest',
  languages: ['hu', 'en'],
  defaultLanguage: 'hu',

  // Fictional contact details (real clinic's are not reproduced here).
  contact: {
    addressLine: 'Rózsa utca 7',
    postcode: '2000',
    city: 'Szentendre',
    country: 'Hungary',
    phone: '+36 26 555 0142',
    email: 'info@coronadental.example',
    website: 'https://corona.appointer.hu',
  },

  emergencyNumber: '112',

  brand: {
    themeColor: '#0f766e',
    backgroundColor: '#f2fbf9',
  },

  officeHoursSummary: 'Mon–Fri 8:00–20:00, closed Saturday and Sunday.',

  promo: {
    en: 'Start package — 31,000 HUF: a panoramic X-ray, a professional cleaning, and a specialist consultation, for new patients.',
    hu: 'Start csomag — 31 000 Ft: panoráma röntgen, professzionális fogtisztítás és szakorvosi konzultáció, új pácienseknek.',
  },

  faq: {
    en: {
      office_hours:
        'Our office hours are Monday to Friday, 8:00 AM to 8:00 PM. We are closed on Saturdays and Sundays. Please book an appointment before visiting.',
      services:
        'We offer general dentistry (exams, cleanings, fillings, crowns), dental hygiene and gum treatment, esthetic dentistry (whitening, veneers, cosmetic fillings), tooth replacement and implantology, oral surgery (complex extractions, bone grafting, sinus lift), orthodontics (removable, fixed and invisible appliances), pediatric dentistry, and root canal treatment with microscopic endodontics.',
      insurance:
        'We are a private clinic. We accept health-savings-account cards (egészségpénztár) and self-paying patients; we do not bill public health insurance.',
      emergency:
        'For a dental emergency during our office hours, please call the clinic and we will fit you in as soon as possible. For a life-threatening emergency, such as severe bleeding or swelling that affects breathing, call 112 or go to the nearest emergency room immediately. If a tooth has been knocked out, keep it moist in milk or saliva and come in right away.',
      cancellation_policy:
        'Please cancel or reschedule at least 24 hours in advance. For a treatment cancelled within 24 hours, a standby fee of 10,000 HUF per scheduled hour applies.',
      new_patient_info:
        'If you are a new patient, please arrive 10–15 minutes early and bring your photo ID, your health-insurance (TAJ) card, and a list of any medications you currently take. Ask us about the Start package for new patients.',
      location:
        'We are located at Rózsa utca 7, 2000 Szentendre. You can reach us by phone at +36 26 555 0142 or by email at info@coronadental.example. You can also find us online at https://corona.appointer.hu.',
      payment_options:
        'You can pay in cash in Hungarian forint, by bank card (VISA or Mastercard), or with a health-savings-account card (egészségpénztári kártya).',
    },
    hu: {
      office_hours:
        'Rendelőnk nyitvatartása hétfőtől péntekig 8:00 és 20:00 óra között. Szombaton és vasárnap zárva tartunk. Kérjük, látogatása előtt egyeztessen időpontot.',
      services:
        'Szolgáltatásaink: általános fogászat (vizsgálatok, fogkőeltávolítás, tömések, koronák), dentálhigiénia és ínykezelés, esztétikai fogászat (fogfehérítés, héjak, esztétikus tömések), fogpótlás és implantológia, szájsebészet (komplex foghúzás, csontpótlás, sinus lift), fogszabályozás (kivehető, rögzített és láthatatlan készülékek), gyermekfogászat, valamint gyökérkezelés mikroszkópos endodonciával.',
      insurance:
        'Magánrendelő vagyunk. Elfogadunk egészségpénztári kártyát, és önfizető pácienseket is szívesen fogadunk; a társadalombiztosítás felé nem számlázunk.',
      emergency:
        'Fogászati sürgősség esetén nyitvatartási időben hívja a rendelőt, és igyekszünk mielőbb fogadni Önt. Életveszélyes helyzetben, például erős vérzés vagy a légzést akadályozó duzzanat esetén, hívja a 112-t, vagy menjen azonnal a legközelebbi sürgősségi ügyeletre. Ha egy fog kiesett, tartsa nedvesen tejben vagy nyálban, és jöjjön be mihamarabb.',
      cancellation_policy:
        'Kérjük, legalább 24 órával korábban mondja le vagy módosítsa az időpontját. A 24 órán belül lemondott kezelés esetén minden megkezdett kezelési óráért 10 000 Ft készenléti díjat számítunk fel.',
      new_patient_info:
        'Új páciensként kérjük, érkezzen 10–15 perccel korábban, és hozza magával a személyi igazolványát, a TAJ-kártyáját, valamint a jelenleg szedett gyógyszerei listáját. Kérdezzen a Start csomagunkról, amelyet új pácienseknek kínálunk.',
      location:
        'Címünk: 2000 Szentendre, Rózsa utca 7. Telefonon a +36 26 555 0142 számon, e-mailben az info@coronadental.example címen érhet el minket. Online is megtalál minket a https://corona.appointer.hu oldalon.',
      payment_options:
        'Fizethet készpénzzel forintban, bankkártyával (VISA vagy Mastercard), illetve egészségpénztári kártyával.',
    },
  },

  seed: {
    // Fictional staff — the real practitioners' names are not used.
    staff: [
      {
        title: 'Dr.',
        givenName: 'Gábor',
        familyName: 'Kovács',
        email: 'admin@coronadental.example',
        role: 'ADMIN',
        specialty: 'General Dentistry & Implantology',
      },
      {
        title: 'Dr.',
        givenName: 'Gábor',
        familyName: 'Kovács',
        email: 'gabor.kovacs@coronadental.example',
        role: 'PROVIDER',
        specialty: 'General Dentistry & Implantology',
        bio: 'Practice director; general and implant dentistry.',
      },
      {
        title: 'Dr.',
        givenName: 'Anna',
        familyName: 'Tóth',
        email: 'anna.toth@coronadental.example',
        role: 'PROVIDER',
        specialty: 'Esthetic Dentistry & Orthodontics',
        bio: 'Esthetic dentistry and orthodontics.',
      },
      {
        title: 'Dr.',
        givenName: 'Péter',
        familyName: 'Nagy',
        email: 'peter.nagy@coronadental.example',
        role: 'PROVIDER',
        specialty: 'Oral Surgery',
        bio: 'Oral surgery — extractions, bone grafting, sinus lift.',
        // Surgery days only, so seeded availability differs from the others.
        weekdays: [2, 4],
      },
      {
        givenName: 'Réka',
        familyName: 'Horváth',
        email: 'reka.horvath@coronadental.example',
        role: 'ASSISTANT',
      },
    ],
    availability: {
      weekdays: [1, 2, 3, 4, 5],
      horizonDays: 10,
      // Long single day (8–20) with a midday break, matching the stated hours.
      blocks: [
        { title: 'Morning Availability', start: '08:00', end: '12:00', type: 'AVAILABLE' },
        { title: 'Midday Break', start: '12:00', end: '13:00', type: 'BLOCKED', notes: 'Break' },
        { title: 'Afternoon Availability', start: '13:00', end: '20:00', type: 'AVAILABLE' },
      ],
    },
  },
};
