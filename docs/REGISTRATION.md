# Регистрация бота MAX Sport

Материалы для кабинета MAX (чат-бот → мини-приложение). Лендинг и картинки в репозиторий не входят.

## Имя


| Поле         | Значение             |
| ------------ | -------------------- |
| Display name | `MAX Sport`          |
| Username     | `@gov_max_sport_bot` |


Имя совпадает с продуктом: жюри и игроки сразу связывают бота с треком MAX. «Сбор» и «Лобби» — доменные термины, не бренд.

## Описание

Лимит поля — 200 символов. Ниже — готовые строки для вставки.

**Основное:**

```
Собирает любительские игры: лобби со слотами и амплуа, живая карточка в чат, сплит аренды и отметка о явке. Найди состав своего уровня — и матч не сорвётся.
```

**Короткий:**

```
Любительский спорт в MAX: слоты с амплуа, карточка в чат, сплит аренды, отметка о явке. Собери состав и не сорви игру.
```

## Сайт и Mini App

В кабинет MAX (сайт бота и URL мини-приложения):

```
https://max-sport.sabirov.tech
```

Карта путей, сервер Selectel и TLS — в [INFRA.md](INFRA.md). Код и лендинг пока не поднимаем.

## Промпты логотипа

Метафора знака: **пустой слот в составе, который закрывается** — геометрия линий корта плюс один выделенный слот. Не мяч, не человечки, не молния, не официальный логотип MAX.

Палитра: уголь `#1A1A1A` + court-green / lime `#C8F54A` + белый. Настроение: ночная любительская игра, не фитнес-приложение.

Генерировать квадрат **512×512**, проверять читаемость на **40px**.

### A. Аватар бота (главный)

Для Midjourney / Flux / Ideogram. В кабинет MAX.

```
App icon, 512x512, square, centered. Premium sports messenger mark for "MAX Sport": a reduced geometric court — two thin white boundary lines on charcoal #1A1A1A forming a compact playing-field frame; inside, a 2x3 grid of empty rounded slots; five slots are muted dark gray, ONE slot is solid court-green lime #C8F54A, as if a missing teammate just filled in. Flat vector, 2 colors plus white, optical balance, 8–12% padding from edges, no text, no wordmark. Feels like a night amateur match, precise and ownable, works at 40px.

Negative: soccer ball, basketball, volleyball, mascot, people, faces, lightning bolt, swoosh, 3D, glossy, bevel, gradient mesh, neon glow, purple AI gradient, photorealism, clutter, official MAX messenger logo, Cyrillic, Latin letters, watermark.
```

Midjourney: добавить `--ar 1:1 --stylize 80`.

### B. Wordmark + mark (шапка Mini App)

Два прогона: тёмный и светлый фон.

**Тёмный:**

```
Horizontal brand lockup for "MAX Sport". Left: the same geometric court-slot mark (charcoal field, white court lines, one lime filled slot). Right: wordmark "MAX Sport" in a tight grotesque, white, generous tracking, "Sport" slightly heavier than "MAX". Dark charcoal background #1A1A1A, lime #C8F54A as a 2px underline accent under "Sport" only. Sparse, editorial, no tagline, no icons around. Square or wide 16:9 crop, print-sharp vector look.

Negative: ball, mascot, 3D, script font, Inter-clone blandness, copied MAX official logo, extra slogans, sport photography.
```

**Светлый:**

```
Same MAX Sport lockup on warm off-white paper. Mark: charcoal court frame, one lime slot. Wordmark charcoal. Tiny lime tick under "Sport". Quiet, athletic, not a gym brand.

Negative: ball, mascot, 3D, gradients, stock fitness imagery.
```



### C. Brand-kit board (опционально)

Если нужна система, а не только иконка. 2×3, тёмный presentation canvas.

```
Create a premium brand-kit overview image for "MAX Sport".

Brand strategy:
- category: amateur team sport inside a messenger
- audience: organizers and players filling last-minute slots
- personality: precise, night-game, communal, unceremonious
- core metaphor: the empty slot that gets filled
- logo idea: geometric court frame + 2x3 slot grid with one lime-filled seat; no ball, no people

Layout:
2x3 grid on a dark charcoal presentation canvas with strong gutters, clean alignment, refined negative space.

Panels:
1. Logo cover — large mark + "MAX Sport" wordmark, charcoal, lime accent, huge negative space
2. Browser / product surface — Mini App header with the mark, URL max-sport.sabirov.tech
3. Chat card fragment — a MAX-style message card showing "11/12" and one highlighted empty slot (UI as identity, not a full fake dashboard)
4. Atmosphere — night indoor court, empty lime-lit slot on the floor, cinematic, no faces
5. Construction — grid, court lines, slot geometry, why the mark exists
6. Tagline — "Fill the slot." large type, quiet background

Visual mode: dark athletic / calm operator, not developer-cyber, not fitness.

Palette: charcoal, court-green lime, white, muted fog gray.

Style: premium, sparse, cinematic, intentional, brand-guidelines deck, no clutter, no copied real-world logos.

Typography: readable grotesque, minimal, no tiny fake text.

Logo: professional, symbolic, simple, ownable, repeated consistently across panels.

Negative: soccer ball, mascot, lightning, purple AI glow, generic startup gradient, official MAX logo copy, QR codes, crowded mockups.
```

