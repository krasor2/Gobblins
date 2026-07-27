# Cave Tribe

Proceduralna gra plemienna w **Phaser 4 + TypeScript + Vite**.

Aktualna wersja: **v0.1.1 — Readability & Formation Polish**.

## Co zawiera patch

- jaskinię generowaną deterministycznie z trzech rodzajów skały,
- poprawione ściany z górną powierzchnią, licem i cieniem kontaktowym,
- podłogę bez widocznych poziomych pasów tile'i,
- sześć goblinów ustawionych w rozproszonej formacji,
- większe modularne sylwetki z odłączonymi dłońmi i stopami,
- prawdziwe warianty ciał, głów, uszu i fryzur,
- profile przód, bok oraz tył,
- dynamiczny minimalny zoom i kadrowanie plemienia,
- czytelne zaznaczenie, hover i znaczniki rozkazów,
- responsywny HUD z przyciskami dotykowymi,
- walidację generatora na 200 seedach.

## Uruchomienie

```bash
npm install
npm run dev
```

Kontrola jakości i jednoplikowy build HTML:

```bash
npm run check
npm run build
```

Gotowy plik powstaje jako:

```text
dist/Cave-Tribe-v0.1.1-PLAY.html
```

## Sterowanie

| Akcja | Sterowanie |
|---|---|
| Wybór goblina | LPM / dotyk |
| Zaznaczenie grupy | przeciągnięcie LPM |
| Dodanie do wyboru | Shift + LPM |
| Ruch | PPM / dotyk podłogi |
| Kamera | WASD / środkowy przycisk |
| Zoom | rolka / pinch |
| Skup zaznaczonych | F |
| Skup plemię | Home |
| Reset zoomu | 0 |
| Nowa jaskinia | R |
| Ten sam seed | Shift + R |
| Pełny ekran | Alt + Enter |
| Debug | ` |
