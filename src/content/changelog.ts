// The changelog page (spec 0018): what changed, written for hikers. Newest entry first.
//
// To add an entry, put it at the top with every language and run `npm test`: the tests say what is
// missing. If the newest entry has today's date, add the change to that entry instead: dates can't repeat.
// Keep it short and only list what users see. Dates are plain YYYY-MM-DD (shown in UTC).
import type { Locale } from "next-intl";

export type ChangeKind = "new" | "improved" | "fixed";
export type Localized = Record<Locale, string>;
export type Change = { kind: ChangeKind; text: Localized };
export type ChangelogEntry = { date: string; title: Localized; changes: Change[] };

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-10-07",
    title: {
      en: "Change the date of many stamps at once, a page of your stats, moved stamps on the map and an account menu",
      ru: "Дату можно изменить сразу у многих печатей, появились страница статистики и меню аккаунта, а перенесённые печати видны на карте",
      hu: "Sok bélyegzés dátuma módosítható egyszerre, megjelent a statisztikák oldala és a fiókmenü, az áthelyezett bélyegzők pedig látszanak a térképen",
      de: "Das Datum vieler Stempel auf einmal ändern, eine Seite mit deiner Statistik, ein Kontomenü und verlegte Stempel auf der Karte",
    },
    changes: [
      {
        kind: "new",
        text: {
          en: "Change the date of many stamps at once. Press \"Change dates\" above the list of stages, tick the stamps you collected on the same day (Shift-click ticks a whole range, \"Select stage\" a whole stage, \"Select all\" everything), type a date or pick it in the calendar and press Apply: all of them get that date, or none does if something went wrong. On a stage's header \"Set date\" does the first steps for you. A retired stamp cannot get a date from the day it retired on. The mode needs JavaScript; the date field of each stamp stays as it was.",
          ru: "Дату можно изменить сразу у многих печатей. Нажмите «Изменить даты» над списком этапов, отметьте печати, собранные в один день (щелчок с Shift отмечает весь диапазон, «Выбрать этап» — весь этап, «Выбрать все» — всё), введите дату или выберите её в календаре и нажмите «Применить»: все отмеченные получат эту дату, а если что-то пойдёт не так, не изменится ни одна. На заголовке этапа «Задать дату» сделает первые шаги за вас. Упразднённой печати нельзя поставить дату начиная со дня её упразднения. Режиму нужен JavaScript; поле даты у каждой печати осталось прежним.",
          hu: "Sok bélyegzés dátuma módosítható egyszerre. Nyomd meg a „Dátumok módosítása” gombot a szakaszok listája fölött, jelöld ki az ugyanazon a napon begyűjtött bélyegzőket (a Shift-kattintás egy egész tartományt jelöl ki, a „Szakasz kijelölése” egy egész szakaszt, a „Mind kijelöl” mindent), írd be a dátumot vagy válaszd ki a naptárban, és nyomd meg az Alkalmaz gombot: mindegyik megkapja a dátumot, vagy ha valami elromlik, egyik sem. A szakasz fejlécén a „Dátum beállítása” elvégzi helyetted az első lépéseket. A megszűnt bélyegző nem kaphat a megszűnése napjától kezdve dátumot. A módhoz JavaScript kell; az egyes bélyegzők dátummezője a régi maradt.",
          de: "Das Datum vieler Stempel lässt sich auf einmal ändern. Tippe über der Etappenliste auf „Daten ändern“, hake die Stempel an, die du am selben Tag gesammelt hast (mit Shift-Klick einen ganzen Bereich, mit „Etappe wählen“ eine ganze Etappe, mit „Alle auswählen“ alles), gib ein Datum ein oder wähle es im Kalender und tippe auf Übernehmen: Alle bekommen dieses Datum, oder keiner, wenn etwas schiefgeht. Auf dem Kopf einer Etappe erledigt „Datum setzen“ die ersten Schritte für dich. Ein eingestellter Stempel kann ab dem Tag seiner Einstellung kein Datum bekommen. Der Modus braucht JavaScript; das Datumsfeld jedes Stempels bleibt, wie es war.",
        },
      },
      {
        kind: "new",
        text: {
          en: "A page of your own stats. \"My stats\", in the Account menu at the top right, shows your stamps, kilometres and completed stages and the chart of stamps per month, which has left the settings page. The chart now names every month, also the ones without a stamp; hover over a month, tap it or move to it with the arrow keys to see how many stamps and kilometres it holds and in which stages. A stretch counts in the month of the later of its two stamps, so a stamp placed next to an older one adds the whole stretch to the month it was stamped in. When the months do not fit a phone, the chart scrolls inside its frame.",
          ru: "Страница с вашей статистикой. «Моя статистика», в меню «Аккаунт» вверху справа, показывает ваши печати, километры и пройденные этапы и диаграмму печатей по месяцам, которая ушла со страницы настроек. Теперь на диаграмме подписан каждый месяц, в том числе без единой печати; наведите курсор на месяц, коснитесь его или перейдите к нему стрелками, чтобы увидеть, сколько в нём печатей и километров и какие этапы. Отрезок засчитывается в месяц более поздней из двух его печатей, поэтому печать, поставленная рядом с более старой, добавляет весь отрезок в тот месяц, когда её поставили. Если месяцы не помещаются на телефоне, диаграмма прокручивается внутри своей рамки.",
          hu: "Saját statisztikai oldal. A „Statisztikáim” a jobb felső sarokban lévő „Fiók” menüben mutatja a bélyegzéseidet, a kilométereidet és a teljesített szakaszokat, valamint a havi bélyegzések diagramját, amely elköltözött a beállítások oldaláról. A diagram mostantól minden hónapot megnevez, a bélyegzés nélkülieket is; vidd az egeret egy hónap fölé, koppints rá, vagy lépj rá a nyilakkal, hogy lásd, hány bélyegzést és kilométert tartalmaz, és mely szakaszokat. Egy szakasz a két bélyegzője közül a későbbi hónapjába számít, így egy régebbi mellé tett bélyegzés a teljes szakaszt ahhoz a hónaphoz adja, amikor lepecsételted. Ha a hónapok nem férnek el a telefonon, a diagram a saját keretében görgethető.",
          de: "Eine Seite mit deiner eigenen Statistik. „Meine Statistik“, im Menü „Konto“ oben rechts, zeigt deine Stempel, Kilometer und abgeschlossenen Etappen und das Diagramm der Stempel pro Monat, das die Einstellungsseite verlassen hat. Das Diagramm nennt jetzt jeden Monat, auch die ohne Stempel; fahre mit der Maus über einen Monat, tippe ihn an oder gehe mit den Pfeiltasten hin, um zu sehen, wie viele Stempel und Kilometer er enthält und in welchen Etappen. Ein Abschnitt zählt in den Monat des späteren seiner beiden Stempel, ein Stempel neben einem älteren fügt also den ganzen Abschnitt dem Monat hinzu, in dem er gesetzt wurde. Passen die Monate nicht auf ein Handy, scrollt das Diagramm in seinem Rahmen.",
        },
      },
      {
        kind: "improved",
        text: {
          en: "When you are signed in, one Account menu in the top right corner of each page replaces the Friends, My stats and Account links: it opens a short list with My stats, Friends (while the feature is on), Settings and Sign out. The language dropdown now sits in the same top bar of every page except the \"page not found\" page, and the page that used to be called Account is called Settings. The menu works with the keyboard (Escape closes it) and without JavaScript.",
          ru: "Когда вы вошли в аккаунт, одно меню «Аккаунт» в правом верхнем углу каждой страницы заменяет ссылки «Друзья», «Моя статистика» и «Аккаунт»: оно открывает короткий список — «Моя статистика», «Друзья» (пока функция включена), «Настройки» и «Выйти». Выбор языка теперь стоит в той же верхней панели каждой страницы, кроме страницы «не найдено», а страница, которая называлась «Аккаунт», теперь называется «Настройки». Меню работает с клавиатуры (Escape закрывает его) и без JavaScript.",
          hu: "Bejelentkezve minden oldal jobb felső sarkában egyetlen „Fiók” menü váltja fel a „Barátok”, a „Statisztikáim” és a „Fiók” linkeket: rövid listát nyit a „Statisztikáim”, a „Barátok” (amíg a funkció be van kapcsolva), a „Beállítások” és a „Kijelentkezés” pontokkal. A nyelvválasztó mostantól ugyanabban a felső sávban áll minden oldalon, kivéve a „nem található” oldalt, a korábban „Fiók” nevű oldal neve pedig „Beállítások”. A menü billentyűzettel is működik (az Escape bezárja), JavaScript nélkül is.",
          de: "Wenn du angemeldet bist, ersetzt ein Menü „Konto“ in der oberen rechten Ecke jeder Seite die Links „Freunde“, „Meine Statistik“ und „Konto“: Es öffnet eine kurze Liste mit „Meine Statistik“, „Freunde“ (solange die Funktion aktiv ist), „Einstellungen“ und „Abmelden“. Die Sprachauswahl steht jetzt in derselben oberen Leiste jeder Seite außer der Seite „nicht gefunden“, und die Seite, die bisher „Konto“ hieß, heißt jetzt „Einstellungen“. Das Menü funktioniert mit der Tastatur (Escape schließt es) und ohne JavaScript.",
        },
      },
      {
        kind: "new",
        text: {
          en: "If the MTSZ moves a stamp to a new place, the page shows where it is now. For 180 days after the move the stamp's row, on your page and on a friend's, and its popup on the map say when it moved, where the stamp is now and that you should check the new place if you use an older map or booklet, and its marker on the map has a ring around it. Nothing is lost: you keep the stamp you collected, with its date. The \"Stamps\" switch under the map hides the rings together with the dots.",
          ru: "Если MTSZ переносит печать на новое место, страница показывает, где она теперь. В течение 180 дней после переноса строка печати (у вас и у друга) и её окно на карте сообщают, когда её перенесли, где она сейчас и что стоит проверить новое место, если вы пользуетесь более старой картой или книжкой, а метка печати на карте обведена кольцом. Ничего не теряется: собранная печать остаётся с её датой. Переключатель «Штампы» под картой скрывает кольца вместе с точками.",
          hu: "Ha az MTSZ áthelyez egy bélyegzőt, az oldal azt mutatja, hol van most. Az áthelyezés után 180 napig a bélyegző sora (nálad és egy barátodnál is) és a térképi ablaka megmondja, mikor helyezték át, hol van most, és hogy ellenőrizd az új helyet, ha régebbi térképet vagy füzetet használsz; a bélyegző jelölőjét a térképen gyűrű veszi körül. Semmi sem vész el: a begyűjtött bélyegződ a dátumával együtt megmarad. A térkép alatti „Bélyegzők” kapcsoló a gyűrűket is elrejti a pontokkal együtt.",
          de: "Wenn der MTSZ einen Stempel an einen neuen Ort verlegt, zeigt die Seite, wo er jetzt ist. 180 Tage nach der Verlegung sagen die Zeile des Stempels (bei dir und bei einem Freund) und sein Fenster auf der Karte, wann er verlegt wurde, wo er jetzt ist und dass du die neue Stelle prüfen solltest, wenn du eine ältere Karte oder ein älteres Heft benutzt; die Markierung auf der Karte hat einen Ring. Nichts geht verloren: Der gesammelte Stempel bleibt mit seinem Datum. Der Schalter „Stempel“ unter der Karte blendet die Ringe zusammen mit den Punkten aus.",
        },
      },
      {
        kind: "new",
        text: {
          en: "Found a stamp in a different place than the map says? Every stamp's popup on the map now has a \"Report a wrong location\" link. It opens the feedback form for that stamp, so you only have to say what you found.",
          ru: "Нашли печать не там, где показывает карта? В окне каждой печати на карте теперь есть ссылка «Сообщить о неверном месте». Она открывает форму обратной связи для этой печати, так что остаётся только написать, что вы нашли.",
          hu: "Máshol találtál egy bélyegzőt, mint ahol a térkép mutatja? A térképen minden bélyegző ablakában ott van a „Hibás hely jelentése” hivatkozás. Az adott bélyegzőhöz megnyitja a visszajelző űrlapot, így csak azt kell leírnod, mit találtál.",
          de: "Einen Stempel an einem anderen Ort gefunden, als die Karte zeigt? Im Fenster jedes Stempels auf der Karte gibt es jetzt den Link „Falschen Standort melden“. Er öffnet das Feedback-Formular für diesen Stempel, sodass du nur noch schreiben musst, was du gefunden hast.",
        },
      },
      {
        kind: "new",
        text: {
          en: "The About page and the map now say how fresh the trail data is: which MTSZ file it comes from, with its date.",
          ru: "Страница «О приложении» и карта теперь сообщают, насколько свежи данные трассы: из какого файла MTSZ они взяты, и его дату.",
          hu: "A Névjegy oldal és a térkép mostantól megmondja, mennyire friss az útvonal adata: melyik MTSZ-fájlból származik, és mi a dátuma.",
          de: "Die Seite „Über das Projekt“ und die Karte sagen jetzt, wie aktuell die Streckendaten sind: aus welcher MTSZ-Datei sie stammen, mit Datum.",
        },
      },
    ],
  },
  {
    date: "2026-10-06",
    title: {
      en: "Retired stamps are kept, and wide screens are used properly",
      ru: "Упразднённые печати сохраняются, а широкие экраны используются как следует",
      hu: "A megszűnt bélyegzők megmaradnak, a széles képernyők pedig jobban kihasználtak",
      de: "Eingestellte Stempel bleiben erhalten, und breite Bildschirme werden besser genutzt",
    },
    changes: [
      {
        kind: "new",
        text: {
          en: "A stamp that no longer exists (for now Nyírjesi-erdészház, replaced by Vércverés in 2014) is kept as a \"retired stamp\" instead of disappearing together with your stamp on it. If you walked past before it retired, it shows in the stage list with a short note, and you can add it with the day you collected it; \"Show retired stamps\" lists all of them. Retired stamps do not count towards the 161, your kilometres or a stage, and a friend's page does not show them.",
          ru: "Печать, которой больше нет (пока это Нирьеши-эрдёшхаз, замещённый Вёрчверёшем в 2014 году), теперь хранится как «упразднённая печать» и не исчезает вместе с вашей отметкой. Если вы прошли это место до её упразднения, она показана в списке этапа с короткой пометкой, и её можно добавить с датой, когда вы её собрали; «Показывать упразднённые печати» выводит все такие печати. Упразднённые печати не входят в 161, километры и этап, а на странице друга их не видно.",
          hu: "A már nem létező bélyegző (egyelőre a Nyírjesi-erdészház, amelyet 2014-ben a Vércverés váltott fel) „megszűnt bélyegzőként” megmarad, és nem tűnik el a rajta lévő bélyegzéseddel együtt. Ha a megszűnése előtt jártál ott, megjelenik a szakasz listájában egy rövid megjegyzéssel, és hozzáadhatod a begyűjtés napjával; a „Megszűnt bélyegzők mutatása” mindet listázza. A megszűnt bélyegzők nem számítanak bele a 161-be, a kilométerekbe és a szakaszba, a barátod oldalán pedig nem látszanak.",
          de: "Ein Stempel, den es nicht mehr gibt (vorerst das Nyírjesi-erdészház, 2014 durch Vércverés ersetzt), bleibt als „eingestellter Stempel“ erhalten und verschwindet nicht mit deinem Eintrag darauf. Wenn du vor seiner Einstellung dort vorbeigekommen bist, steht er mit einer kurzen Notiz in der Etappenliste, und du kannst ihn mit dem Tag eintragen, an dem du ihn gesammelt hast; „Eingestellte Stempel anzeigen“ listet alle. Eingestellte Stempel zählen nicht zu den 161, zu deinen Kilometern oder zu einer Etappe, und auf der Seite eines Freundes erscheinen sie nicht.",
        },
      },
      {
        kind: "improved",
        text: {
          en: "On a computer screen the logo, the page and the footer now share one width and line up at the left edge instead of the logo sitting at the far corner of the window. From 1024 px My progress has two columns: your figures are on the left with the map, which stays in view while the list of stages scrolls on the right. A friend's page puts the comparison next to the stage list, and the Friends page puts your name and invite link next to your friends. The long pages (About, Changelog, Useful links, Feedback) keep a comfortable line length. Phones look the same, except that the page margin is a little narrower, and layouts narrower than 375 px are no longer guaranteed.",          ru: "На экране компьютера логотип, страница и подвал теперь имеют одну ширину и выровнены по левому краю, а логотип больше не прижат к дальнему углу окна. От 1024 px в «Моём прогрессе» две колонки: слева ваши цифры и карта, которая остаётся на виду, пока справа прокручивается список этапов. На странице друга сравнение стоит рядом со списком этапов, а на странице «Друзья» ваше имя и ссылка-приглашение стоят рядом со списком друзей. Длинные страницы («О приложении», «История изменений», «Полезные ссылки», «Обратная связь») сохраняют удобную длину строки. На телефонах всё выглядит так же, только поля страницы стали немного уже, а работа на экранах уже 375 px больше не гарантируется.",
          hu: "Számítógép képernyőjén a logó, az oldal és a lábléc mostantól egy szélességű, és a bal szélen igazodik, a logó pedig nem ül az ablak távoli sarkában. 1024 px-től a Haladásom oldalnak két oszlopa van: balra kerülnek a számaid és a térkép, amely szem előtt marad, amíg jobbra a szakaszok listája görgethető. A barát oldalán az összehasonlítás a szakaszlista mellett áll, a Barátok oldalon pedig a neved és a meghívó link a barátaid listája mellett. A hosszú oldalak (Névjegy, Változások, Hasznos linkek, Visszajelzés) kényelmes sorhosszt tartanak. Telefonon minden ugyanúgy néz ki, csak az oldal margója lett kissé keskenyebb, a 375 px-nél keskenyebb képernyőkre pedig már nem vállalunk garanciát.",
          de: "Auf einem Computerbildschirm haben Logo, Seite und Fußzeile jetzt eine gemeinsame Breite und stehen am linken Rand bündig, das Logo sitzt nicht mehr in der fernen Ecke des Fensters. Ab 1024 px hat „Mein Fortschritt“ zwei Spalten: Links stehen deine Zahlen und die Karte, die im Blick bleibt, während die Etappenliste rechts scrollt. Auf der Seite eines Freundes steht der Vergleich neben der Etappenliste, und auf der Freunde-Seite stehen dein Name und der Einladungslink neben deinen Freunden. Die langen Seiten (Über das Projekt, Änderungen, Nützliche Links, Feedback) behalten eine angenehme Zeilenlänge. Auf dem Handy sieht alles gleich aus, nur der Seitenrand ist etwas schmaler, und Bildschirme schmaler als 375 px werden nicht mehr garantiert.",
        },
      },
      {
        kind: "improved",
        text: {
          en: "Easier to read and to tap: the stamp numbers in the list are darker, the buttons for extra stamps have more contrast, the link in the corner of the map is underlined, and the Sign out button on the Account page is a bigger target.",
          ru: "Читать и нажимать стало проще: номера печатей в списке темнее, у кнопок дополнительных печатей выше контраст, ссылка в углу карты подчёркнута, а кнопка «Выйти» на странице аккаунта стала крупнее.",
          hu: "Könnyebb olvasni és megérinteni: a lista bélyegzőszámai sötétebbek, az extra bélyegzők gombjai kontrasztosabbak, a térkép sarkában lévő link alá van húzva, a Fiók oldal Kijelentkezés gombja pedig nagyobb célpont.",
          de: "Besser lesbar und leichter zu tippen: Die Stempelnummern in der Liste sind dunkler, die Schaltflächen für Zusatzstempel haben mehr Kontrast, der Link in der Ecke der Karte ist unterstrichen, und die Abmelden-Schaltfläche auf der Kontoseite ist eine größere Fläche.",
        },
      },
    ],
  },
  {
    date: "2026-10-05",
    title: {
      en: "New stamps are required only from their official date",
      ru: "Новые печати обязательны только с официальной даты",
      hu: "Az új bélyegzők csak a hivatalos dátumuktól kötelezők",
      de: "Neue Stempel sind erst ab ihrem offiziellen Datum erforderlich",
    },
    changes: [
      {
        kind: "improved",
        text: {
          en: "A stamp the MTSZ added later (Vércverés, Lokó-pihenő, Nagy-nyugodó, Csobánc, Encs, Badacsony, Tepke and others) is now required only from the day the MTSZ announced. If you walked past before that day, you are not missing it: the stretch still counts towards your kilometres and the stage, and the place says \"Not required for your walk\". Every new stamp shows the date it is required from, with a short explanation when you tap the date. A friend's page follows the same rule.",
          ru: "Печать, которую МТСЗ добавил позже (Вёрчверёш, Локо-пихенё, Надь-ньугодо, Чобанц, Энч, Бадачонь, Тепке и другие), теперь обязательна только с даты, объявленной МТСЗ. Если вы прошли это место раньше, вам её не недостаёт: участок по-прежнему засчитывается в километры и этап, а у места написано «Для вашего прохождения не требуется». У каждой новой печати показана дата, с которой она обязательна, а по нажатию на дату открывается короткое пояснение. Страница друга работает по тому же правилу.",
          hu: "Az MTSZ által később felvett bélyegző (Vércverés, Lokó-pihenő, Nagy-nyugodó, Csobánc, Encs, Badacsony, Tepke és mások) mostantól csak az MTSZ által közölt naptól kötelező. Ha előtte jártál ott, nem hiányzik: a szakasz továbbra is beleszámít a kilométereidbe és a szakaszba, a helynél pedig ez áll: „A te túrádhoz nem kötelező”. Minden új bélyegzőnél látszik, melyik naptól kötelező, a dátumra koppintva pedig rövid magyarázat nyílik. A barátod oldala ugyanezt a szabályt követi.",
          de: "Ein Stempel, den der MTSZ später ergänzt hat (Vércverés, Lokó-pihenő, Nagy-nyugodó, Csobánc, Encs, Badacsony, Tepke und weitere), ist jetzt erst ab dem vom MTSZ angekündigten Tag erforderlich. Wenn du vorher dort vorbeigekommen bist, fehlt er dir nicht: Der Abschnitt zählt weiter zu deinen Kilometern und zur Etappe, und der Ort trägt den Hinweis „Für deine Wanderung nicht erforderlich“. Jeder neue Stempel zeigt das Datum, ab dem er erforderlich ist, und beim Antippen des Datums erscheint eine kurze Erklärung. Die Seite eines Freundes folgt derselben Regel.",
        },
      },
    ],
  },
  {
    date: "2026-10-04",
    title: {
      en: "Friends, German, Hungarian by default, a language menu and a logo",
      ru: "Друзья, немецкий язык, венгерский по умолчанию, меню языков и логотип",
      hu: "Barátok, német nyelv, alapértelmezett magyar, nyelvválasztó menü és logó",
      de: "Freunde, Deutsch, Ungarisch als Standard, ein Sprachmenü und ein Logo",
    },
    changes: [
      {
        kind: "new",
        text: {
          en: "Friends: connect with a friend through your invite link and see each other's progress (places, kilometres, stages). Nothing is shared until you accept a request, and you can stop sharing or remove a friend at any time.",
          ru: "Друзья: свяжитесь с другом по своей ссылке-приглашению и смотрите прогресс друг друга (места, километры, этапы). Ничего не показывается, пока вы не примете запрос, а делиться или дружить можно перестать в любой момент.",
          hu: "Barátok: kapcsolódj egy baráthoz a meghívólinkeddel, és lássátok egymás előrehaladását (helyek, kilométerek, szakaszok). Addig semmi nem látszik, amíg el nem fogadsz egy kérést, a megosztást és a barátságot pedig bármikor megszüntetheted.",
          de: "Freunde: Verbinde dich über deinen Einladungslink mit einem Freund und seht gegenseitig euren Fortschritt (Orte, Kilometer, Etappen). Nichts wird geteilt, bevor du eine Anfrage annimmst, und du kannst das Teilen oder die Freundschaft jederzeit beenden.",
        },
      },
      {
        kind: "new",
        text: {
          en: "On a friend's page you can compare your progress: the kilometres and places you both walked, only you, only them and neither, how every stage stands, and one map that shows who walked which stretch (switch between both, yours and theirs; tap a place to jump to it in the list).",
          ru: "На странице друга можно сравнить прогресс: километры и места, которые прошли оба, только вы, только друг и никто, как обстоит дело с каждым этапом, и одна карта, на которой видно, кто какой участок прошёл (переключение: оба, ваша, его; нажмите на место, чтобы перейти к нему в списке).",
          hu: "A barátod oldalán összehasonlíthatod az előrehaladásotokat: a kilométerek és helyek, amelyeket mindketten, csak te, csak ő vagy egyikőtök sem járt be, minden szakasz állása, és egy térkép, amely megmutatja, ki melyik szakaszt járta be (váltás: mindkettő, a tiéd, az övé; koppints egy helyre, hogy a listában odaugorj).",
          de: "Auf der Seite eines Freundes kannst du euren Fortschritt vergleichen: die Kilometer und Orte, die ihr beide, nur du, nur der Freund oder keiner gewandert seid, wie jede Etappe steht, und eine Karte, die zeigt, wer welchen Abschnitt gewandert ist (Umschalten: beide, deine, seine; tippe einen Ort an, um in der Liste dorthin zu springen).",
        },
      },
      {
        kind: "improved",
        text: {
          en: "The buttons on the Friends page react at once (they are disabled with a spinner while they work), the page says what happened (name saved, request approved, friend removed and so on), and removing a friend or creating a new invite link asks you first.",
          ru: "Кнопки на странице друзей реагируют сразу (пока работают, они неактивны и показывают индикатор), страница сообщает, что произошло (имя сохранено, запрос одобрен, друг удалён и так далее), а удаление друга или создание новой ссылки-приглашения сначала спрашивает подтверждение.",
          hu: "A Barátok oldal gombjai azonnal reagálnak (munka közben letiltva vannak, és forgó jelzést mutatnak), az oldal kiírja, mi történt (név mentve, kérés elfogadva, barát eltávolítva és így tovább), a barát eltávolítása és az új meghívólink létrehozása pedig előbb megerősítést kér.",
          de: "Die Schaltflächen auf der Freunde-Seite reagieren sofort (während sie arbeiten, sind sie gesperrt und zeigen einen Ladekreis), die Seite sagt, was passiert ist (Name gespeichert, Anfrage angenommen, Freund entfernt und so weiter), und das Entfernen eines Freundes oder ein neuer Einladungslink fragt zuerst nach.",
        },
      },
      {
        kind: "new",
        text: {
          en: "The whole site is now also in German, stamp descriptions included. The German text was not proofread: tell us about mistakes through the feedback form.",
          ru: "Весь сайт теперь есть и на немецком, включая описания печатей. Немецкий текст не вычитывался: об ошибках можно сообщить через форму обратной связи.",
          hu: "Az egész oldal már németül is elérhető, a bélyegzőleírásokkal együtt. A német szöveget nem lektorálták: a hibákat a visszajelzési űrlapon jelezheted.",
          de: "Die ganze Website gibt es jetzt auch auf Deutsch, einschließlich der Stempelbeschreibungen. Der deutsche Text wurde nicht Korrektur gelesen: Sag uns über das Feedback-Formular Bescheid, wenn du Fehler findest.",
        },
      },
      {
        kind: "improved",
        text: {
          en: "The language is chosen from a dropdown menu instead of a row of buttons.",
          ru: "Язык выбирается в выпадающем меню, а не рядом кнопок.",
          hu: "A nyelvet mostantól legördülő menüből választhatod gombsor helyett.",
          de: "Die Sprache wählst du jetzt aus einem Dropdown-Menü statt über eine Reihe von Schaltflächen.",
        },
      },
      {
        kind: "improved",
        text: {
          en: "Hungarian is now the default language: a visitor whose browser language is none of ours sees the site in Hungarian.",
          ru: "Теперь по умолчанию используется венгерский: посетитель, язык браузера которого не входит в наш список, увидит сайт на венгерском.",
          hu: "Az alapértelmezett nyelv mostantól a magyar: aki böngészőjének nyelve egyik nyelvünk sem, magyarul látja az oldalt.",
          de: "Ungarisch ist jetzt die Standardsprache: Wer einen Browser in einer Sprache hat, die wir nicht anbieten, sieht die Website auf Ungarisch.",
        },
      },
      {
        kind: "new",
        text: {
          en: "Every page now shows the Kéktúra tracker logo in the top-left corner; one tap takes you to the main page, or to your dashboard when you are signed in.",
          ru: "На каждой странице в левом верхнем углу теперь логотип трекера Kéktúra: одно нажатие ведёт на главную страницу, а если вы вошли, то на ваш дашборд.",
          hu: "Minden oldal bal felső sarkában ott van a Kéktúra követő logója: egy koppintás a főoldalra vezet, bejelentkezve pedig az áttekintő oldaladra.",
          de: "Jede Seite zeigt jetzt oben links das Logo des Kéktúra-Trackers; ein Tipp bringt dich zur Startseite, angemeldet zu deinem Dashboard.",
        },
      },
    ],
  },
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
