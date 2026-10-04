// The changelog page (spec 0018): what changed, written for hikers. Newest entry first.
//
// To add an entry, put it at the top with all three languages and run `npm test`: the tests say what is
// missing. If the newest entry has today's date, add the change to that entry instead: dates can't repeat.
// Keep it short and only list what users see. Dates are plain YYYY-MM-DD (shown in UTC).
import type { Locale } from "next-intl";

export type ChangeKind = "new" | "improved" | "fixed";
export type Localized = Record<Locale, string>;
export type Change = { kind: ChangeKind; text: Localized };
export type ChangelogEntry = { date: string; title: Localized; changes: Change[] };

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-10-03",
    title: {
      en: "Stamp descriptions in your language, and yyyy-mm-dd dates",
      ru: "Описания печатей на вашем языке и даты yyyy-mm-dd",
      hu: "Bélyegzőleírások a te nyelveden és yyyy-mm-dd dátumok",
      de: "Stempelbeschreibungen in deiner Sprache und Daten als yyyy-mm-dd",
    },
    changes: [
      {
        kind: "fixed",
        text: {
          en: "Where to find a stamp is now shown in full: long descriptions wrap onto more lines instead of being cut off with “…”.",
          ru: "Описание, где искать печать, теперь показывается целиком: длинный текст переносится на следующие строки, а не обрезается многоточием.",
          hu: "A bélyegző helyének leírása mostantól teljes egészében látszik: a hosszú szöveg új sorba tör, és nem vágja le a „…”.",
          de: "Wo man einen Stempel findet, wird jetzt vollständig angezeigt: Lange Beschreibungen laufen in mehrere Zeilen um, statt mit „…“ abgeschnitten zu werden.",
        },
      },
      {
        kind: "new",
        text: {
          en: "Where to find each stamp is now also written in English and Russian (in Hungarian it stays as published). The translations were not proofread: tell us about mistakes through the feedback form.",
          ru: "Описание, где искать каждую печать, теперь есть и на русском, и на английском (на венгерском остаётся как опубликовано). Переводы не вычитывались: об ошибках можно сообщить через форму обратной связи.",
          hu: "Mostantól minden bélyegző helyének leírása angolul és oroszul is olvasható (magyarul úgy marad, ahogy megjelent). A fordításokat nem lektorálták: a hibákat a visszajelzési űrlapon jelezheted.",
          de: "Wo man jeden Stempel findet, steht jetzt auch auf Englisch und Russisch (auf Ungarisch bleibt es, wie es veröffentlicht wurde). Die Übersetzungen wurden nicht Korrektur gelesen: Sag uns über das Feedback-Formular Bescheid, wenn du Fehler findest.",
        },
      },
      {
        kind: "improved",
        text: {
          en: "The date of a stamp is typed and shown as yyyy-mm-dd, the same in every browser, with a calendar button next to it.",
          ru: "Дата печати вводится и показывается в формате yyyy-mm-dd (год-месяц-день), одинаково во всех браузерах; рядом есть кнопка календаря.",
          hu: "A bélyegzés dátumát yyyy-mm-dd (év-hónap-nap) formában írod és látod, minden böngészőben egyformán, mellette naptár gombbal.",
          de: "Das Datum eines Stempels wird als yyyy-mm-dd eingegeben und angezeigt, in jedem Browser gleich, mit einer Kalender-Schaltfläche daneben.",
        },
      },
      {
        kind: "fixed",
        text: {
          en: "The progress page no longer scrolls sideways on a phone: the buttons and the date of a stamp move to their own line when they don't fit next to the name.",
          ru: "Страница прогресса больше не прокручивается вбок на телефоне: кнопки и дата печати переходят на отдельную строку, если не помещаются рядом с названием.",
          hu: "A haladás oldal telefonon már nem görgethető oldalra: a gombok és a bélyegző dátuma külön sorba kerülnek, ha nem férnek el a név mellett.",
          de: "Die Fortschrittsseite scrollt auf dem Handy nicht mehr seitwärts: Die Schaltflächen und das Datum eines Stempels rutschen in eine eigene Zeile, wenn sie neben dem Namen nicht Platz haben.",
        },
      },
    ],
  },
  {
    date: "2026-10-02",
    title: {
      en: "Pages, feedback and stamp dates",
      ru: "Страницы, обратная связь и даты печатей",
      hu: "Oldalak, visszajelzés és bélyegzési dátumok",
      de: "Seiten, Feedback und Stempeldaten",
    },
    changes: [
      {
        kind: "new",
        text: {
          en: "About, Changelog and Useful links pages, linked from the footer.",
          ru: "Страницы «О приложении», «История изменений» и «Полезные ссылки» со ссылками внизу сайта.",
          hu: "Névjegy, Változások és Hasznos linkek oldal, az oldal alján elhelyezett hivatkozásokkal.",
          de: "Die Seiten „Über das Projekt“, „Änderungen“ und „Nützliche Links“, verlinkt in der Fußzeile.",
        },
      },
      {
        kind: "new",
        text: {
          en: "A feedback form: your message goes straight to the developer.",
          ru: "Форма обратной связи: ваше сообщение сразу попадает к разработчику.",
          hu: "Visszajelzési űrlap: az üzeneted egyenesen a fejlesztőhöz jut.",
          de: "Ein Feedback-Formular: Deine Nachricht geht direkt an den Entwickler.",
        },
      },
      {
        kind: "new",
        text: {
          en: "An Account page, where you can delete your account and all your stamps.",
          ru: "Страница «Аккаунт»: там можно удалить аккаунт и все свои печати.",
          hu: "Fiók oldal, ahol törölheted a fiókodat és az összes bélyegzésedet.",
          de: "Eine Seite „Konto“, auf der du dein Konto und alle deine Stempel löschen kannst.",
        },
      },
      {
        kind: "new",
        text: {
          en: "Every stamp has a date you can change, for stamps you collected earlier.",
          ru: "У каждой печати есть дата, которую можно изменить, если вы собрали её раньше.",
          hu: "Minden bélyegzésnek van dátuma, amelyet módosíthatsz, ha korábban gyűjtötted be.",
          de: "Jeder Stempel hat ein Datum, das du ändern kannst, für Stempel, die du früher gesammelt hast.",
        },
      },
      {
        kind: "new",
        text: {
          en: "Extra stamps show which stage they belong to, and each stage links to its extra stamps.",
          ru: "У дополнительных штампов указан этап, а у каждого этапа есть ссылка на его дополнительные штампы.",
          hu: "Az extra bélyegzőknél látszik, melyik szakaszhoz tartoznak, és minden szakasz a saját extra bélyegzőire mutat.",
          de: "Zusatzstempel zeigen, zu welcher Etappe sie gehören, und jede Etappe verweist auf ihre Zusatzstempel.",
        },
      },
      {
        kind: "improved",
        text: {
          en: "New stamps get the date in your own time zone.",
          ru: "Новые печати получают дату по вашему часовому поясу.",
          hu: "Az új bélyegzések a saját időzónád szerinti dátumot kapják.",
          de: "Neue Stempel erhalten das Datum in deiner eigenen Zeitzone.",
        },
      },
      {
        kind: "improved",
        text: {
          en: "The stamps-per-month chart moved to the Account page.",
          ru: "График «Печати по месяцам» перенесён на страницу «Аккаунт».",
          hu: "A „Bélyegzések havonta” diagram átkerült a Fiók oldalra.",
          de: "Das Diagramm „Stempel pro Monat“ ist auf die Seite „Konto“ umgezogen.",
        },
      },
      {
        kind: "improved",
        text: {
          en: "“Sign out” is now on the Account page, and the “Settings” link is called “Account”.",
          ru: "Кнопка «Выйти» теперь на странице «Аккаунт», а ссылка «Настройки» называется «Аккаунт».",
          hu: "A „Kijelentkezés” mostantól a Fiók oldalon található, a „Beállítások” hivatkozás pedig „Fiók” néven szerepel.",
          de: "„Abmelden“ befindet sich jetzt auf der Seite „Konto“, und der Link „Einstellungen“ heißt jetzt „Konto“.",
        },
      },
      {
        kind: "improved",
        text: {
          en: "Stamp buttons react instantly, even on a slow connection.",
          ru: "Кнопки печатей реагируют мгновенно, даже при медленном соединении.",
          hu: "A bélyegzés gombok azonnal reagálnak, lassú kapcsolaton is.",
          de: "Stempel-Schaltflächen reagieren sofort, auch bei langsamer Verbindung.",
        },
      },
      {
        kind: "fixed",
        text: {
          en: "Signing out works even before the page has finished loading.",
          ru: "Выход из аккаунта работает, даже если страница ещё не загрузилась полностью.",
          hu: "A kijelentkezés akkor is működik, ha az oldal még nem töltött be teljesen.",
          de: "Das Abmelden funktioniert auch, bevor die Seite fertig geladen ist.",
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
      de: "Etappen und der Routenplaner",
    },
    changes: [
      {
        kind: "new",
        text: {
          en: "Stamps are grouped into the 27 official stages, with a button to mark a whole stage at once.",
          ru: "Печати сгруппированы по 27 официальным этапам; есть кнопка, которая отмечает сразу весь этап.",
          hu: "A bélyegzések a 27 hivatalos szakasz szerint vannak csoportosítva, egy gombbal az egész szakasz megjelölhető.",
          de: "Die Stempel sind in die 27 offiziellen Etappen gegliedert, mit einer Schaltfläche, um eine ganze Etappe auf einmal zu markieren.",
        },
      },
      {
        kind: "new",
        text: {
          en: "Route planner: pick two stamps on the map to see the distance, ascent, descent and walking time between them.",
          ru: "Планировщик маршрута: выберите на карте две печати, и вы увидите расстояние, набор высоты, спуск и время в пути между ними.",
          hu: "Útvonaltervező: válassz ki két bélyegzőt a térképen, és megkapod a köztük lévő távolságot, szintemelkedést, lejtést és menetidőt.",
          de: "Routenplaner: Wähle zwei Stempel auf der Karte, um Entfernung, Aufstieg, Abstieg und Gehzeit zwischen ihnen zu sehen.",
        },
      },
      {
        kind: "new",
        text: {
          en: "Restaurants near the trail on the map.",
          ru: "Рестораны рядом с тропой на карте.",
          hu: "Éttermek a nyomvonal mellett a térképen.",
          de: "Restaurants in der Nähe des Wegs auf der Karte.",
        },
      },
      {
        kind: "new",
        text: {
          en: "A fullscreen map and a switch for each map layer.",
          ru: "Полноэкранная карта и переключатель для каждого слоя карты.",
          hu: "Teljes képernyős térkép és külön kapcsoló minden térképréteghez.",
          de: "Eine Vollbildkarte und ein Schalter für jede Kartenebene.",
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
      de: "Erste Version",
    },
    changes: [
      {
        kind: "new",
        text: { en: "Sign in with Google.", ru: "Вход через Google.", hu: "Bejelentkezés Google-lel.", de: "Anmeldung mit Google." },
      },
      {
        kind: "new",
        text: {
          en: "The 161 official stamping places: mark the ones you have collected.",
          ru: "161 официальный пункт с печатью: отмечайте собранные.",
          hu: "A 161 hivatalos bélyegzőhely: jelöld meg, amelyeket már begyűjtöttél.",
          de: "Die 161 offiziellen Stempelstellen: Markiere die, die du gesammelt hast.",
        },
      },
      {
        kind: "new",
        text: {
          en: "A map of the trail that draws the stretches you have walked in blue.",
          ru: "Карта маршрута, на которой пройденные участки нарисованы синим.",
          hu: "A nyomvonal térképe, amelyen a teljesített szakaszok kékkel látszanak.",
          de: "Eine Karte des Wegs, die die Abschnitte, die du gewandert bist, blau einzeichnet.",
        },
      },
      {
        kind: "new",
        text: {
          en: "Kilometres walked, percentage and stamps per month.",
          ru: "Пройденные километры, процент и печати по месяцам.",
          hu: "Megtett kilométerek, százalék és bélyegzések havonta.",
          de: "Gewanderte Kilometer, Prozentwert und Stempel pro Monat.",
        },
      },
      {
        kind: "new",
        text: {
          en: "Extra stamps near the trail, counted separately.",
          ru: "Дополнительные штампы рядом с тропой, учитываются отдельно.",
          hu: "Extra bélyegzők a nyomvonal mellett, külön számolva.",
          de: "Zusatzstempel in der Nähe des Wegs, getrennt gezählt.",
        },
      },
      {
        kind: "new",
        text: {
          en: "Russian, English and Hungarian versions.",
          ru: "Версии на русском, английском и венгерском языках.",
          hu: "Orosz, angol és magyar nyelvű változat.",
          de: "Russische, englische und ungarische Version.",
        },
      },
    ],
  },
];
