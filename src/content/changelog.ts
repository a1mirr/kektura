// The changelog page (spec 0018): what changed, written for hikers. Newest entry first.
//
// To add an entry, put it at the top with all three languages and run `npm test`: the tests say what is
// missing. Keep it short and only list what users see. Dates are plain YYYY-MM-DD (shown in UTC).
import type { Locale } from "next-intl";

export type ChangeKind = "new" | "improved" | "fixed";
export type Localized = Record<Locale, string>;
export type Change = { kind: ChangeKind; text: Localized };
export type ChangelogEntry = { date: string; title: Localized; changes: Change[] };

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-10-02",
    title: {
      en: "Pages, feedback and stamp dates",
      ru: "Страницы, обратная связь и даты печатей",
      hu: "Oldalak, visszajelzés és bélyegzési dátumok",
    },
    changes: [
      {
        kind: "new",
        text: {
          en: "About, Changelog and Useful links pages, linked from the footer.",
          ru: "Страницы «О приложении», «История изменений» и «Полезные ссылки» со ссылками внизу сайта.",
          hu: "Névjegy, Változások és Hasznos linkek oldal, az oldal alján elhelyezett hivatkozásokkal.",
        },
      },
      {
        kind: "new",
        text: {
          en: "A feedback form: your message goes straight to the developer.",
          ru: "Форма обратной связи: ваше сообщение сразу попадает к разработчику.",
          hu: "Visszajelzési űrlap: az üzeneted egyenesen a fejlesztőhöz jut.",
        },
      },
      {
        kind: "new",
        text: {
          en: "Account settings, where you can delete your account and all your stamps.",
          ru: "Настройки аккаунта: там можно удалить аккаунт и все свои печати.",
          hu: "Fiókbeállítások, ahol törölheted a fiókodat és az összes bélyegzésedet.",
        },
      },
      {
        kind: "new",
        text: {
          en: "Every stamp has a date you can change, for stamps you collected earlier.",
          ru: "У каждой печати есть дата, которую можно изменить, если вы собрали её раньше.",
          hu: "Minden bélyegzésnek van dátuma, amelyet módosíthatsz, ha korábban gyűjtötted be.",
        },
      },
      {
        kind: "new",
        text: {
          en: "Extra stamps show which stage they belong to, and each stage links to its extra stamps.",
          ru: "У дополнительных штампов указан этап, а у каждого этапа есть ссылка на его дополнительные штампы.",
          hu: "Az extra bélyegzőknél látszik, melyik szakaszhoz tartoznak, és minden szakasz a saját extra bélyegzőire mutat.",
        },
      },
      {
        kind: "improved",
        text: {
          en: "New stamps get the date in your own time zone.",
          ru: "Новые печати получают дату по вашему часовому поясу.",
          hu: "Az új bélyegzések a saját időzónád szerinti dátumot kapják.",
        },
      },
      {
        kind: "improved",
        text: {
          en: "The stamps-per-month chart moved to Account settings.",
          ru: "График «Печати по месяцам» перенесён в настройки аккаунта.",
          hu: "A „Bélyegzések havonta” diagram átkerült a fiókbeállításokba.",
        },
      },
      {
        kind: "fixed",
        text: {
          en: "Signing out works even before the page has finished loading.",
          ru: "Выход из аккаунта работает, даже если страница ещё не загрузилась полностью.",
          hu: "A kijelentkezés akkor is működik, ha az oldal még nem töltött be teljesen.",
        },
      },
    ],
  },
  {
    date: "2026-10-01",
    title: {
      en: "Stages and the route planner",
      ru: "Этапы и планировщик маршрута",
      hu: "Szakaszok és útvonaltervező",
    },
    changes: [
      {
        kind: "new",
        text: {
          en: "Stamps are grouped into the 27 official stages, with a button to mark a whole stage at once.",
          ru: "Печати сгруппированы по 27 официальным этапам; есть кнопка, которая отмечает сразу весь этап.",
          hu: "A bélyegzések a 27 hivatalos szakasz szerint vannak csoportosítva, egy gombbal az egész szakasz megjelölhető.",
        },
      },
      {
        kind: "new",
        text: {
          en: "Route planner: pick two stamps on the map to see the distance, ascent, descent and walking time between them.",
          ru: "Планировщик маршрута: выберите на карте две печати, и вы увидите расстояние, набор высоты, спуск и время в пути между ними.",
          hu: "Útvonaltervező: válassz ki két bélyegzőt a térképen, és megkapod a köztük lévő távolságot, szintemelkedést, lejtést és menetidőt.",
        },
      },
      {
        kind: "new",
        text: {
          en: "Restaurants near the trail on the map.",
          ru: "Рестораны рядом с тропой на карте.",
          hu: "Éttermek a nyomvonal mellett a térképen.",
        },
      },
      {
        kind: "new",
        text: {
          en: "A fullscreen map and a switch for each map layer.",
          ru: "Полноэкранная карта и переключатель для каждого слоя карты.",
          hu: "Teljes képernyős térkép és külön kapcsoló minden térképréteghez.",
        },
      },
    ],
  },
  {
    date: "2026-09-29",
    title: {
      en: "First version",
      ru: "Первая версия",
      hu: "Első verzió",
    },
    changes: [
      {
        kind: "new",
        text: { en: "Sign in with Google.", ru: "Вход через Google.", hu: "Bejelentkezés Google-lel." },
      },
      {
        kind: "new",
        text: {
          en: "The 161 official stamping places: mark the ones you have collected.",
          ru: "161 официальный пункт с печатью: отмечайте собранные.",
          hu: "A 161 hivatalos bélyegzőhely: jelöld meg, amelyeket már begyűjtöttél.",
        },
      },
      {
        kind: "new",
        text: {
          en: "A map of the trail that draws the stretches you have walked in blue.",
          ru: "Карта маршрута, на которой пройденные участки нарисованы синим.",
          hu: "A nyomvonal térképe, amelyen a teljesített szakaszok kékkel látszanak.",
        },
      },
      {
        kind: "new",
        text: {
          en: "Kilometres walked, percentage and stamps per month.",
          ru: "Пройденные километры, процент и печати по месяцам.",
          hu: "Megtett kilométerek, százalék és bélyegzések havonta.",
        },
      },
      {
        kind: "new",
        text: {
          en: "Extra stamps near the trail, counted separately.",
          ru: "Дополнительные штампы рядом с тропой, учитываются отдельно.",
          hu: "Extra bélyegzők a nyomvonal mellett, külön számolva.",
        },
      },
      {
        kind: "new",
        text: {
          en: "Russian, English and Hungarian versions.",
          ru: "Версии на русском, английском и венгерском языках.",
          hu: "Orosz, angol és magyar nyelvű változat.",
        },
      },
    ],
  },
];
